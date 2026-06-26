import { useStore } from '../store';
import { Card, CardContent } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { AlertCircle, ArrowUpRight, ArrowDownRight, Award } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Transactions } from './Transactions';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subMonths } from 'date-fns';



const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0284c7', '#be185d'];

export const Dashboard = () => {
  const { 
    holdings, 
    portfolioSummary,
    transactions,
    securities,
    prices,
    fxRates,
    exchanges,
    theme
  } = useStore();

  const isGreen = portfolioSummary.unrealizedGainUSD >= 0;

  const [chartRange, setChartRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('6M');
  const [metric, setMetric] = useState<'VALUE' | 'RETURN'>('VALUE');

  // Sector Allocation Data
  const sectorData = useMemo(() => {
    const map = new Map<string, number>();
    holdings.forEach(h => {
      map.set(h.security.sector, (map.get(h.security.sector) || 0) + h.marketValueUSD);
    });
    return Array.from(map.entries()).map(([sector, value]) => ({
      sector,
      value: value,
      pct: portfolioSummary.totalMarketValueUSD > 0 ? (value / portfolioSummary.totalMarketValueUSD) * 100 : 0
    })).sort((a, b) => b.pct - a.pct);
  }, [holdings, portfolioSummary.totalMarketValueUSD]);

  // Calculates total portfolio value and cost in USD on a specific date based on transactions ledger
  const getPortfolioDataOnDate = (dateStr: string) => {
    const txsUpToDate = transactions.filter(t => t.date <= dateStr);
    if (txsUpToDate.length === 0) return { value: 0, costBasis: 0, gain: 0, gainPct: 0 };

    // Sum shares and cost basis owned on that date
    const holdingsMap = new Map<string, { shares: number; costBasisUSD: number }>();
    
    // Sort transactions chronologically to calculate cost basis correctly
    const sortedTxs = [...txsUpToDate].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningCashUSD = 0;
    let cumulativeDepositsUSD = 0;

    sortedTxs.forEach(tx => {
      const sec = securities.find(s => s.id === tx.securityId);
      if (sec && sec.type === 'INDEX') return;

      // Find historically accurate FX rate on or before the transaction date
      let txFxRate = 1;
      if (tx.currency !== 'USD') {
        const matchRates = fxRates
          .filter((fx) => fx.fromCurrency === 'USD' && fx.toCurrency === tx.currency && fx.date <= tx.date)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        txFxRate = matchRates.length > 0 ? matchRates[0].rate : 1;
      }
      const txFxRateToUSD = 1 / txFxRate;

      if (tx.type === 'DIVIDEND') {
        const divAmount = tx.shares * tx.pricePerShare;
        runningCashUSD += divAmount * txFxRateToUSD;
        return;
      }
      if (tx.type === 'FEE') {
        runningCashUSD -= (tx.fees || 0) * txFxRateToUSD;
        if (runningCashUSD < 0) {
          cumulativeDepositsUSD += Math.abs(runningCashUSD);
          runningCashUSD = 0;
        }
        return;
      }
      if (tx.type === 'SPLIT') return;

      const current = holdingsMap.get(tx.securityId) || { shares: 0, costBasisUSD: 0 };

      if (tx.type === 'BUY') {
        const txCost = (tx.shares * tx.pricePerShare) + (tx.fees || 0);
        const txCostUSD = txCost * txFxRateToUSD;
        current.shares += tx.shares;
        current.costBasisUSD += txCostUSD;
        
        runningCashUSD -= txCostUSD;
        if (runningCashUSD < 0) {
          cumulativeDepositsUSD += Math.abs(runningCashUSD);
          runningCashUSD = 0;
        }
      } else if (tx.type === 'INHERIT') {
        current.shares += tx.shares;
      } else if (tx.type === 'SELL') {
        const avgCostUSD = current.shares > 0 ? (current.costBasisUSD / current.shares) : 0;
        const proceeds = (tx.shares * tx.pricePerShare) - (tx.fees || 0);
        const proceedsUSD = proceeds * txFxRateToUSD;
        
        current.shares = Math.max(0, current.shares - tx.shares);
        current.costBasisUSD = Math.max(0, current.costBasisUSD - (tx.shares * avgCostUSD));
        
        runningCashUSD += proceedsUSD;
      }

      holdingsMap.set(tx.securityId, current);
    });

    let totalValueUSD = runningCashUSD;
    let totalCostUSD = cumulativeDepositsUSD;

    holdingsMap.forEach((data, secId) => {
      if (data.shares <= 0) return;
      const sec = securities.find(s => s.id === secId);
      if (!sec) return;

      const currency = sec.currency || exchanges.find(e => e.id === sec.exchangeId)?.currency || 'USD';

      // Find price on or before dateStr, with fallback to earliest price if not yet traded
      const matchPrices = prices
        .filter(p => p.securityId === secId && p.date <= dateStr)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      let price = 0;
      if (matchPrices.length > 0) {
        price = matchPrices[0].price;
      } else {
        const allSecPrices = prices
          .filter(p => p.securityId === secId)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        if (allSecPrices.length > 0) {
          price = allSecPrices[0].price;
        }
      }

      // Find FX rate on or before dateStr, with fallback to earliest rate
      let fxRate = 1;
      if (currency !== 'USD') {
        const matchFX = fxRates
          .filter(fx => fx.fromCurrency === 'USD' && fx.toCurrency === currency && fx.date <= dateStr)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (matchFX.length > 0) {
          fxRate = matchFX[0].rate;
        } else {
          const allFX = fxRates
            .filter(fx => fx.fromCurrency === 'USD' && fx.toCurrency === currency)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          if (allFX.length > 0) {
            fxRate = allFX[0].rate;
          }
        }
      }
      const fxRateToUSD = 1 / fxRate;

      const valLocal = data.shares * price;
      const valUSD = valLocal * fxRateToUSD;
      totalValueUSD += valUSD;
    });

    const gain = totalValueUSD - totalCostUSD;
    const gainPct = totalCostUSD > 0 ? (gain / totalCostUSD) * 100 : 0;

    return {
      value: Number(totalValueUSD.toFixed(2)),
      costBasis: Number(totalCostUSD.toFixed(2)),
      gain: Number(gain.toFixed(2)),
      gainPct: Number(gainPct.toFixed(2))
    };
  };

  const portfolioTrend = useMemo(() => {
    const data = [];
    let steps = 6;
    let getLabel = (d: Date) => format(d, 'MMM');
    let subFunc = (d: Date, amount: number) => subMonths(d, amount);

    if (chartRange === '1M') {
      steps = 15; // 15 data points
      getLabel = (d: Date) => format(d, 'dd MMM');
      subFunc = (d: Date, amount: number) => new Date(d.getTime() - amount * 2 * 86400000); // 2 days interval
    } else if (chartRange === '3M') {
      steps = 12; // 12 weeks
      getLabel = (d: Date) => format(d, 'dd MMM');
      subFunc = (d: Date, amount: number) => new Date(d.getTime() - amount * 7 * 86400000); // weekly interval
    } else if (chartRange === '6M') {
      steps = 12; // bi-weekly
      getLabel = (d: Date) => format(d, 'MMM yy');
      subFunc = (d: Date, amount: number) => new Date(d.getTime() - amount * 15 * 86400000); // 15 days interval
    } else if (chartRange === '1Y') {
      steps = 12; // monthly
      getLabel = (d: Date) => format(d, 'MMM yy');
      subFunc = subMonths;
    } else if (chartRange === 'ALL') {
      const txDates = transactions.map(t => new Date(t.date).getTime());
      const oldestTxTime = txDates.length > 0 ? Math.min(...txDates) : Date.now() - 365 * 86400000;
      const intervalMs = (Date.now() - oldestTxTime) / 12;
      steps = 12;
      getLabel = (d: Date) => format(d, 'MMM yy');
      subFunc = (d: Date, amount: number) => new Date(d.getTime() - amount * intervalMs);
    }

    for (let i = steps; i >= 0; i--) {
      const d = subFunc(new Date(), i);
      const dateStr = d.toISOString().split('T')[0];
      const metrics = getPortfolioDataOnDate(dateStr);
      data.push({
        month: getLabel(d),
        value: metrics.value,
        gainPct: metrics.gainPct,
        gain: metrics.gain,
        costBasis: metrics.costBasis
      });
    }

    return data;
  }, [transactions, securities, prices, fxRates, chartRange]);

  const latestTrendPoint = portfolioTrend[portfolioTrend.length - 1];
  const isTrendPositive = metric === 'VALUE' ? true : (latestTrendPoint ? latestTrendPoint.gainPct >= 0 : true);
  const strokeColor = metric === 'VALUE' ? '#2563eb' : (isTrendPositive ? '#10b981' : '#f43f5e');

  const { stalePriceWarnings, staleFXWarnings, hasUncertainty } = useMemo(() => {
    return {
      stalePriceWarnings: holdings.filter(h => h.priceStaleStatus === 'STALE' || h.priceStaleStatus === 'VERY_STALE'),
      staleFXWarnings: holdings.filter(h => h.fxStaleStatus === 'STALE'),
      hasUncertainty: holdings.some(h => h.hasUncertainty)
    };
  }, [holdings]);

  const topGainers = useMemo(() => {
    return [...holdings].filter(h => h.sharesOwned > 0).sort((a, b) => b.unrealizedGainLossPctUSD - a.unrealizedGainLossPctUSD).slice(0, 3);
  }, [holdings]);

  const topLosers = useMemo(() => {
    return [...holdings].filter(h => h.sharesOwned > 0).sort((a, b) => a.unrealizedGainLossPctUSD - b.unrealizedGainLossPctUSD).slice(0, 3);
  }, [holdings]);

  // Allocation by country
  const allocation = useMemo(() => {
    const acc = new Map<string, number>();
    holdings.forEach(h => {
      if (h.sharesOwned > 0) {
        acc.set(h.country, (acc.get(h.country) || 0) + h.marketValueUSD);
      }
    });
    return Array.from(acc.entries()).map(([country, val]) => ({
      country,
      pct: portfolioSummary.totalMarketValueUSD > 0 ? (val / portfolioSummary.totalMarketValueUSD) * 100 : 0
    })).sort((a, b) => b.pct - a.pct);
  }, [holdings, portfolioSummary.totalMarketValueUSD]);

  return (
    <div className="space-y-4 pb-6">
      {/* Main Portfolio Summary Card */}
      <Card className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-100 dark:border-slate-800 relative overflow-hidden group shadow-lg transition-colors duration-300">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <CardContent className="p-6 relative z-10">
          <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Value (USD)</div>
          <div className="text-4xl font-black tracking-tight mb-5">{formatMoney(portfolioSummary.totalMarketValueUSD, 'USD')}</div>
          
          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Capital Growth</div>
              <div className="flex items-center space-x-0.5">
                {portfolioSummary.capitalGrowthUSD >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-rose-500 dark:text-rose-450 shrink-0" />
                )}
                <span className={portfolioSummary.capitalGrowthUSD >= 0 ? 'text-emerald-600 dark:text-emerald-400 text-sm font-bold tracking-tight' : 'text-rose-600 dark:text-rose-450 text-sm font-bold tracking-tight'}>
                  {formatMoney(portfolioSummary.capitalGrowthUSD, 'USD')}
                </span>
              </div>
              <div className={`text-[10px] ${portfolioSummary.capitalGrowthUSD >= 0 ? 'text-emerald-500' : 'text-rose-550'} font-semibold mt-0.5`}>
                {portfolioSummary.capitalGrowthUSD >= 0 ? '+' : ''}{formatPercentage(portfolioSummary.capitalGrowthPct)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Dividends</div>
              <div className="flex items-center space-x-1">
                <Award className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
                <span className="text-blue-600 dark:text-blue-450 text-sm font-bold tracking-tight">
                  {formatMoney(portfolioSummary.totalDividendsUSD, 'USD')}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                Total Cash Received
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">Total Return</div>
              <div className="flex items-center space-x-0.5">
                {portfolioSummary.totalReturnUSD >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-500 dark:text-emerald-405 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-rose-500 dark:text-rose-405 shrink-0" />
                )}
                <span className={portfolioSummary.totalReturnUSD >= 0 ? 'text-emerald-600 dark:text-emerald-400 text-sm font-bold tracking-tight' : 'text-rose-600 dark:text-rose-450 text-sm font-bold tracking-tight'}>
                  {formatMoney(portfolioSummary.totalReturnUSD, 'USD')}
                </span>
              </div>
              <div className={`text-[10px] ${portfolioSummary.totalReturnUSD >= 0 ? 'text-emerald-500' : 'text-rose-555'} font-semibold mt-0.5`}>
                {portfolioSummary.totalReturnUSD >= 0 ? '+' : ''}{formatPercentage(portfolioSummary.totalReturnPct)}
              </div>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between items-center">
            <span>Total Cost Basis: {formatMoney(portfolioSummary.totalCostBasisUSD, 'USD')}</span>
            {hasUncertainty && <span className="text-amber-500 font-semibold">* Includes estimated cost basis</span>}
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {(stalePriceWarnings.length > 0 || staleFXWarnings.length > 0 || hasUncertainty) && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="flex items-start space-x-3 p-3.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 leading-relaxed">
              <strong className="block mb-1 font-bold">Portfolio & Data Quality Warnings</strong>
              {hasUncertainty && <div>• Some holdings contain transactions with estimated cost basis (e.g. inherited or predate exchange).</div>}
              {stalePriceWarnings.length > 0 && <div>• {stalePriceWarnings.length} holding(s) with stale prices.</div>}
              {staleFXWarnings.length > 0 && <div>• {staleFXWarnings.length} holding(s) with stale FX rates.</div>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holdings */}
      <Card>
        <CardContent className="p-5">
          <div className="font-bold text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Holdings</div>
          <div className="space-y-3">
            {holdings.filter(h => h.sharesOwned > 0).map(h => (
              <Link 
                to={`/holdings/${h.security.id}`} 
                key={h.security.id} 
                className="flex justify-between items-center w-full hover:bg-slate-50/80 dark:hover:bg-slate-800/50 p-2.5 -mx-2.5 rounded-xl transition-all cursor-pointer"
              >
                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white text-sm tracking-tight">{h.security.ticker}</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{h.exchangeName} • {h.country}</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">{formatPercentage(h.portfolioWeight)}</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{formatMoney(h.marketValueUSD, 'USD')}</div>
                </div>
              </Link>
            ))}
            {holdings.filter(h => h.sharesOwned > 0).length === 0 && (
              <div className="text-slate-400 dark:text-slate-500 text-xs py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                No active holdings in portfolio. Log purchases in the Transactions section below to construct your ledger.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Performance */}
      <Card>
        <CardContent className="p-5">
          <div className="font-bold text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Portfolio Performance</div>
          
          <div className="text-center mb-6">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Overall Return (Total Return)</h2>
            <div className={`text-4xl font-bold ${portfolioSummary.totalReturnUSD >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {portfolioSummary.totalReturnUSD >= 0 ? '+' : ''}{formatPercentage(portfolioSummary.totalReturnPct)}
            </div>
            <div className="text-slate-500 dark:text-slate-400 mt-1">
              {portfolioSummary.totalReturnUSD >= 0 ? '+' : ''}{formatMoney(portfolioSummary.totalReturnUSD, 'USD')}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Portfolio Trend</h3>
              <div className="flex bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5 mt-1 self-start border border-transparent dark:border-slate-700/30">
                <button
                  onClick={() => setMetric('VALUE')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${metric === 'VALUE' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                  Value
                </button>
                <button
                  onClick={() => setMetric('RETURN')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${metric === 'RETURN' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                  Return (%)
                </button>
              </div>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5 space-x-1 self-start sm:self-center border border-transparent dark:border-slate-700/30">
              {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setChartRange(range)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${chartRange === range ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {/* Portfolio Timeline Chart */}
          <div className="h-40 w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioTrend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValueDashboard" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} 
                  tickFormatter={(val) => metric === 'VALUE' ? `$${(val/1000).toFixed(0)}k` : `${val >= 0 ? '+' : ''}${val.toFixed(0)}%`} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                  itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                  formatter={(value: number) => {
                    if (metric === 'VALUE') {
                      return [formatMoney(value, 'USD'), 'Portfolio Value'];
                    } else {
                      return [`${value >= 0 ? '+' : ''}${value.toFixed(2)}%`, 'Performance Return'];
                    }
                  }}
                  labelStyle={{ display: 'none' }}
                />
                <Area 
                  type="monotone" 
                  dataKey={metric === 'VALUE' ? 'value' : 'gainPct'} 
                  stroke={strokeColor} 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorValueDashboard)" 
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
               <span className="text-[10px] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded">Historical Portfolio Performance</span>
            </div>
          </div>

          <div className="h-4 w-full flex rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
             {/* Visualizing Basis vs Gain */}
             <div className="bg-slate-800 dark:bg-slate-700 h-full" style={{ width: `${Math.min(100, (portfolioSummary.totalCostBasisUSD / portfolioSummary.totalMarketValueUSD) * 100)}%` }} title="Cost Basis" />
             {portfolioSummary.unrealizedGainUSD > 0 && (
                <div className="bg-emerald-500 h-full flex-1" title="Unrealized Gain" />
             )}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Basis: {formatMoney(portfolioSummary.totalCostBasisUSD, 'USD')}</span>
            <span>Value: {formatMoney(portfolioSummary.totalMarketValueUSD, 'USD')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Panel */}
      <Card className="dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardContent className="p-5">
          <div className="font-bold text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Transactions</div>
          <Transactions />
        </CardContent>
      </Card>


      {/* Allocation */}
      {holdings.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="font-bold text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Allocation by Country</div>
            <div className="space-y-4">
              {allocation.map(a => (
                <div key={a.country}>
                  <div className="flex justify-between text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-350">
                    <span>{a.country}</span>
                    <span className="font-bold text-slate-950 dark:text-white">{formatPercentage(a.pct)}</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${a.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Allocation by Sector */}
      {holdings.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="font-bold text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Allocation by Sector</div>
            <div className="h-48 w-full mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={sectorData} 
                    dataKey="value" 
                    nameKey="sector" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={50} 
                    outerRadius={70} 
                    paddingAngle={2}
                  >
                    {sectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatMoney(value, 'USD')}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {sectorData.map((s, idx) => (
                <div key={s.sector} className="flex justify-between items-center text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-slate-800 dark:text-slate-200">{s.sector}</span>
                  </div>
                  <span className="font-medium text-slate-900 dark:text-white">{s.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Portfolio Gainers & Losers */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-2 gap-3.5">
          <Card>
            <CardContent className="p-4">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Top Gainers</div>
              <div className="space-y-2">
                {topGainers.filter(g => g.unrealizedGainLossPctUSD > 0).map(g => (
                  <Link 
                    to={`/holdings/${g.security.id}`} 
                    key={g.security.id} 
                    className="flex justify-between items-center w-full hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 -mx-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-slate-900 dark:text-white text-xs tracking-tight">{g.security.ticker}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs font-black">+{formatPercentage(g.unrealizedGainLossPctUSD)}</span>
                  </Link>
                ))}
                {topGainers.filter(g => g.unrealizedGainLossPctUSD > 0).length === 0 && (
                  <div className="text-slate-400 dark:text-slate-500 text-[10px] py-1">No positive gainers yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Top Losers</div>
              <div className="space-y-2">
                {topLosers.filter(l => l.unrealizedGainLossPctUSD < 0).map(l => (
                  <Link 
                    to={`/holdings/${l.security.id}`} 
                    key={l.security.id} 
                    className="flex justify-between items-center w-full hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 -mx-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <span className="font-bold text-slate-900 dark:text-white text-xs tracking-tight">{l.security.ticker}</span>
                    <span className="text-rose-600 dark:text-rose-400 text-xs font-black">{formatPercentage(l.unrealizedGainLossPctUSD)}</span>
                  </Link>
                ))}
                {topLosers.filter(l => l.unrealizedGainLossPctUSD < 0).length === 0 && (
                  <div className="text-slate-400 dark:text-slate-500 text-[10px] py-1">No negative losers.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
