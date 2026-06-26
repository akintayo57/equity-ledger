import { differenceInDays } from 'date-fns';
import { Security, Transaction, PriceUpdate, FXRate, HoldingCalculation, Exchange, IndexDefinition, IndexHistoryPoint } from './types';

export const formatMoney = (value: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatPercentage = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
};

export const getPriceStaleStatus = (dateStr: string): 'FRESH' | 'STALE' | 'VERY_STALE' | 'MISSING' => {
  if (!dateStr) return 'MISSING';
  const days = differenceInDays(new Date(), new Date(dateStr));
  if (days > 90) return 'VERY_STALE';
  if (days > 30) return 'STALE';
  return 'FRESH';
};

export const getFXStaleStatus = (dateStr: string): 'FRESH' | 'STALE' | 'MISSING' => {
  if (!dateStr) return 'MISSING';
  const days = differenceInDays(new Date(), new Date(dateStr));
  if (days > 14) return 'STALE';
  return 'FRESH';
};

export const calculateHoldings = (
  securities: Security[],
  transactions: Transaction[],
  prices: PriceUpdate[],
  fxRates: FXRate[],
  exchanges: Exchange[]
): HoldingCalculation[] => {
  // Helper to get currency for a security
  const getSecurityCurrency = (sec: Security): string => {
    if (sec.currency) return sec.currency;
    const ex = exchanges.find(e => e.id === sec.exchangeId);
    return ex ? ex.currency : 'USD';
  };

  // 1. Filter out splits
  const splits = transactions.filter(tx => tx.type === 'SPLIT');

  // 2. Adjust BUY, SELL, INHERIT transactions for splits chronologically
  const adjustedTxs = transactions.map(tx => {
    if (tx.type === 'DIVIDEND' || tx.type === 'FEE' || tx.type === 'SPLIT') {
      return tx;
    }

    // Find all splits for this security that happened strictly after the transaction date
    const securitySplits = splits
      .filter(s => s.securityId === tx.securityId && s.date > tx.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let adjustedShares = tx.shares;
    let adjustedPrice = tx.pricePerShare;

    securitySplits.forEach(s => {
      // s.shares contains the split ratio (e.g. 2.0 for 2:1 split)
      const ratio = s.shares || 1;
      adjustedShares *= ratio;
      adjustedPrice /= ratio;
    });

    return {
      ...tx,
      shares: adjustedShares,
      pricePerShare: adjustedPrice
    };
  });

  // Group transactions by security and track cost basis in local and USD currencies
  const holdingsMap = new Map<string, { 
    shares: number; 
    costBasis: number; 
    costBasisUSD: number; 
    totalSharesBought: number; 
    hasUncertainty: boolean;
    realizedGainLocal: number;
    realizedGainUSD: number;
  }>();

  // Sort transactions chronologically to calculate average cost step-by-step
  const sortedTxs = [...adjustedTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedTxs.forEach((tx) => {
    if (tx.type === 'DIVIDEND' || tx.type === 'FEE' || tx.type === 'SPLIT') return;

    const current = holdingsMap.get(tx.securityId) || { 
      shares: 0, 
      costBasis: 0, 
      costBasisUSD: 0, 
      totalSharesBought: 0, 
      hasUncertainty: false,
      realizedGainLocal: 0,
      realizedGainUSD: 0
    };
    
    // Find historically accurate FX rate on or before the transaction date
    let txFxRate = 1;
    if (tx.currency !== 'USD') {
      const matchRates = fxRates
        .filter((fx) => fx.fromCurrency === 'USD' && fx.toCurrency === tx.currency && fx.date <= tx.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      txFxRate = matchRates.length > 0 ? matchRates[0].rate : 1;
    }
    const txFxRateToUSD = 1 / txFxRate;

    if (tx.isUncertain || tx.type === 'INHERIT') {
      current.hasUncertainty = true;
    }

    if (tx.type === 'BUY') {
      const txCost = (tx.shares * tx.pricePerShare) + (tx.fees || 0);
      const txCostUSD = txCost * txFxRateToUSD;
      current.shares += tx.shares;
      current.costBasis += txCost;
      current.costBasisUSD += txCostUSD;
      current.totalSharesBought += tx.shares;
    } else if (tx.type === 'INHERIT') {
      current.shares += tx.shares;
      current.totalSharesBought += tx.shares;
    } else if (tx.type === 'SELL') {
      const avgCost = current.shares > 0 ? (current.costBasis / current.shares) : 0;
      const avgCostUSD = current.shares > 0 ? (current.costBasisUSD / current.shares) : 0;
      
      const proceeds = (tx.shares * tx.pricePerShare) - (tx.fees || 0);
      const proceedsUSD = proceeds * txFxRateToUSD;
      
      const soldCost = tx.shares * avgCost;
      const soldCostUSD = tx.shares * avgCostUSD;
      
      current.realizedGainLocal += (proceeds - soldCost);
      current.realizedGainUSD += (proceedsUSD - soldCostUSD);
      
      current.shares -= tx.shares;
      current.costBasis -= soldCost;
      current.costBasisUSD -= soldCostUSD;
      if (current.shares <= 0) {
        current.shares = 0;
        current.costBasis = 0;
        current.costBasisUSD = 0;
      }
    }

    holdingsMap.set(tx.securityId, current);
  });

  const getLatestPrice = (secId: string) => {
    const secPrices = prices.filter((p) => p.securityId === secId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return secPrices.length > 0 ? secPrices[0] : null;
  };

  const getUSDToLocalRate = (localCurrency: string) => {
    if (localCurrency === 'USD') return { rate: 1, date: new Date().toISOString() };
    const rates = fxRates.filter((fx) => fx.fromCurrency === 'USD' && fx.toCurrency === localCurrency).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return rates.length > 0 ? rates[0] : null;
  };

  const holdings: HoldingCalculation[] = [];
  let totalPortfolioUSD = 0;

  securities.forEach((sec) => {
    if (sec.type === 'INDEX') return;
    const data = holdingsMap.get(sec.id);
    if (!data) return; // Keep holdings with shares === 0 to preserve history

    const currency = getSecurityCurrency(sec);
    const latestPriceObj = getLatestPrice(sec.id);
    const fxRateObj = getUSDToLocalRate(currency);

    const fxRateToUSD = fxRateObj ? (1 / fxRateObj.rate) : 0;
    const fxStaleStatus = fxRateObj ? getFXStaleStatus(fxRateObj.date) : 'MISSING';

    const lastPrice = latestPriceObj ? latestPriceObj.price : 0;
    const lastPriceDate = latestPriceObj ? latestPriceObj.date : '';
    const priceStaleStatus = latestPriceObj ? getPriceStaleStatus(latestPriceObj.date) : 'MISSING';

    const marketValueLocal = data.shares * lastPrice;
    const marketValueUSD = marketValueLocal * fxRateToUSD;
    
    totalPortfolioUSD += marketValueUSD;

    const averageCostLocal = data.shares > 0 ? data.costBasis / data.shares : 0;
    const unrealizedGainLocal = marketValueLocal - data.costBasis;
    const unrealizedGainLocalPct = data.costBasis > 0 ? (unrealizedGainLocal / data.costBasis) * 100 : 0;

    const totalCostBasisUSD = data.costBasisUSD; 
    const unrealizedGainUSD = marketValueUSD - totalCostBasisUSD;
    const unrealizedGainUSDPct = totalCostBasisUSD > 0 ? (unrealizedGainUSD / totalCostBasisUSD) * 100 : 0;

    // Calculate total dividends received
    const dividendTxs = transactions.filter(tx => tx.securityId === sec.id && tx.type === 'DIVIDEND');
    let totalDividendsLocal = 0;
    let totalDividendsUSD = 0;

    dividendTxs.forEach(tx => {
      let txFxRate = 1;
      if (tx.currency !== 'USD') {
        const matchRates = fxRates
          .filter((fx) => fx.fromCurrency === 'USD' && fx.toCurrency === tx.currency && fx.date <= tx.date)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        txFxRate = matchRates.length > 0 ? matchRates[0].rate : 1;
      }
      const txFxRateToUSD = 1 / txFxRate;
      
      const divAmount = tx.shares * tx.pricePerShare;
      totalDividendsLocal += divAmount;
      totalDividendsUSD += divAmount * txFxRateToUSD;
    });

    const ex = exchanges.find(e => e.id === sec.exchangeId);
    const country = ex ? ex.country : 'Unknown';
    const exchangeName = ex ? ex.name : (sec.exchangeId || 'Unknown');

    holdings.push({
      security: sec,
      sharesOwned: data.shares,
      averageCost: averageCostLocal,
      totalCostBasis: data.costBasis,
      totalCostBasisUSD,
      lastPrice,
      lastPriceDate,
      priceStaleStatus,
      marketValueLocal,
      marketValueUSD,
      unrealizedGainLocal,
      unrealizedGainLossPctLocal: unrealizedGainLocalPct,
      unrealizedGainUSD,
      unrealizedGainLossPctUSD: unrealizedGainUSDPct,
      portfolioWeight: 0, // Calculated in next step
      fxRateToUSD,
      fxStaleStatus,
      hasUncertainty: data.hasUncertainty,
      totalDividendsLocal,
      totalDividendsUSD,
      currency: currency as any,
      country,
      exchangeName,
      realizedGainLocal: data.realizedGainLocal,
      realizedGainUSD: data.realizedGainUSD,
    });
  });

  // Second pass for portfolio weight
  if (totalPortfolioUSD > 0) {
    holdings.forEach((h) => {
      h.portfolioWeight = (h.marketValueUSD / totalPortfolioUSD) * 100;
    });
  }

  return holdings.sort((a, b) => b.marketValueUSD - a.marketValueUSD);
};

export const calculateIndexHistory = (
  indexDef: IndexDefinition,
  prices: PriceUpdate[]
): IndexHistoryPoint[] => {
  const constituents = new Set(indexDef.constituentIds);
  const exchangePrices = prices.filter(p => constituents.has(p.securityId));
  if (exchangePrices.length === 0) return [];

  // Group prices by date
  const uniqueDates = Array.from(new Set(exchangePrices.map(p => p.date))).sort();

  // Map of securityId -> sorted prices
  const priceMap = new Map<string, PriceUpdate[]>();
  indexDef.constituentIds.forEach(secId => {
    const secPrices = exchangePrices
      .filter(p => p.securityId === secId)
      .sort((a, b) => a.date.localeCompare(b.date));
    priceMap.set(secId, secPrices);
  });

  return uniqueDates.map(date => {
    let sum = 0;
    let count = 0;

    indexDef.constituentIds.forEach(secId => {
      const secPrices = priceMap.get(secId) || [];
      // Find the price on or before this date
      const priceObj = secPrices.filter(p => p.date <= date).slice(-1)[0];
      if (priceObj) {
        sum += priceObj.price;
        count++;
      }
    });

    const val = count > 0 ? (sum / count) * indexDef.scale : 0;

    return {
      id: `${indexDef.id}_${date}`,
      indexId: indexDef.id,
      date,
      value: Number(val.toFixed(2))
    };
  }).filter(pt => pt.value > 0);
};
