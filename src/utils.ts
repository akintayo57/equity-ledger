import { differenceInDays } from 'date-fns';
import { Security, Transaction, PriceUpdate, FXRate, HoldingCalculation } from './types';

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
  fxRates: FXRate[]
): HoldingCalculation[] => {
  // Group transactions by security and track cost basis in local and USD currencies
  const holdingsMap = new Map<string, { shares: number; costBasis: number; costBasisUSD: number; totalSharesBought: number }>();

  // Sort transactions chronologically to calculate average cost step-by-step
  const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sortedTxs.forEach((tx) => {
    if (tx.type === 'DIVIDEND' || tx.type === 'FEE') return; // Fees handled inside BUY/SELL

    const current = holdingsMap.get(tx.securityId) || { shares: 0, costBasis: 0, costBasisUSD: 0, totalSharesBought: 0 };
    
    // Find historically accurate FX rate on or before the transaction date
    let txFxRate = 1;
    if (tx.currency !== 'USD') {
      const matchRates = fxRates
        .filter((fx) => fx.fromCurrency === 'USD' && fx.toCurrency === tx.currency && fx.date <= tx.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      txFxRate = matchRates.length > 0 ? matchRates[0].rate : 1;
    }
    const txFxRateToUSD = 1 / txFxRate;

    if (tx.type === 'BUY') {
      const txCost = (tx.shares * tx.pricePerShare) + (tx.fees || 0);
      const txCostUSD = txCost * txFxRateToUSD;
      current.shares += tx.shares;
      current.costBasis += txCost;
      current.costBasisUSD += txCostUSD;
      current.totalSharesBought += tx.shares;
    } else if (tx.type === 'SELL') {
      const avgCost = current.shares > 0 ? (current.costBasis / current.shares) : 0;
      const avgCostUSD = current.shares > 0 ? (current.costBasisUSD / current.shares) : 0;
      current.shares -= tx.shares;
      current.costBasis -= tx.shares * avgCost;
      current.costBasisUSD -= tx.shares * avgCostUSD;
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
    const data = holdingsMap.get(sec.id);
    if (!data || data.shares <= 0) return; // Only active holdings

    const latestPriceObj = getLatestPrice(sec.id);
    const fxRateObj = getUSDToLocalRate(sec.currency);

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
