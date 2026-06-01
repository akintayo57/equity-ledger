import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Card, CardHeader, CardContent, StatBox } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subMonths } from 'date-fns';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0284c7', '#be185d'];

export const Performance = () => {
  const { holdings, portfolioSummary, transactions, securities, prices, fxRates } = useStore();

  const countryData = useMemo(() => {
    const map = new Map<string, { value: number; cost: number }>();
    holdings.forEach(h => {
      const current = map.get(h.security.country) || { value: 0, cost: 0 };
      current.value += h.marketValueUSD;
      current.cost += h.totalCostBasisUSD;
      map.set(h.security.country, current);
    });
    return Array.from(map.entries()).map(([country, data]) => ({
      country,
      growth: data.cost > 0 ? ((data.value - data.cost) / data.cost) * 100 : 0,
      value: data.value
    })).sort((a, b) => b.value - a.value);
  }, [holdings]);

  const sectorData = useMemo(() => {
    const map = new Map<string, number>();
    holdings.forEach(h => {
      map.set(h.security.sector, (map.get(h.security.sector) || 0) + h.marketValueUSD);
    });
    return Array.from(map.entries()).map(([sector, value]) => ({
      sector,
      value: value,
      pct: (value / portfolioSummary.totalMarketValueUSD) * 100
    })).sort((a, b) => b.pct - a.pct);
  }, [holdings, portfolioSummary.totalMarketValueUSD]);

  const [chartRange, setChartRange] = useState<'1M' | '3M' | '6M' | '1Y'>('6M');
  const [metric, setMetric] = useState<'VALUE' | 'RETURN'>('VALUE');

  // Calculates total portfolio value and cost in USD on a specific date based on transactions ledger
  const getPortfolioDataOnDate = (dateStr: string) => {
    const txsUpToDate = transactions.filter(t => t.date <= dateStr);
    if (txsUpToDate.length === 0) return { value: 0, costBasis: 0, gain: 0, gainPct: 0 };

    // Sum shares and cost basis owned on that date
    const holdingsMap = new Map<string, { shares: number; costBasisUSD: number }>();
    
    // Sort transactions chronologically to calculate cost basis correctly
    const sortedTxs = [...txsUpToDate].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTxs.forEach(tx => {
      if (tx.type === 'DIVIDEND' || tx.type === 'FEE') return;
      const current = holdingsMap.get(tx.securityId) || { shares: 0, costBasisUSD: 0 };
      
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
        current.shares += tx.shares;
        current.costBasisUSD += txCost * txFxRateToUSD;
      } else if (tx.type === 'INHERIT') {
        current.shares += tx.shares;
      } else if (tx.type === 'SELL') {
        const avgCostUSD = current.shares > 0 ? (current.costBasisUSD / current.shares) : 0;
        current.shares = Math.max(0, current.shares - tx.shares);
        current.costBasisUSD = Math.max(0, current.costBasisUSD - (tx.shares * avgCostUSD));
      }

      holdingsMap.set(tx.securityId, current);
    });

    let totalValueUSD = 0;
    let totalCostUSD = 0;

    holdingsMap.forEach((data, secId) => {
      if (data.shares <= 0) return;
      const sec = securities.find(s => s.id === secId);
      if (!sec) return;

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
      if (sec.currency !== 'USD') {
        const matchFX = fxRates
          .filter(fx => fx.fromCurrency === 'USD' && fx.toCurrency === sec.currency && fx.date <= dateStr)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (matchFX.length > 0) {
          fxRate = matchFX[0].rate;
        } else {
          const allFX = fxRates
            .filter(fx => fx.fromCurrency === 'USD' && fx.toCurrency === sec.currency)
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
      totalCostUSD += data.costBasisUSD;
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

  const staleValue = useMemo(() => {
    return holdings
      .filter(h => h.priceStaleStatus === 'STALE' || h.priceStaleStatus === 'VERY_STALE')
      .reduce((acc, curr) => acc + curr.marketValueUSD, 0);
  }, [holdings]);

  const stalePct = portfolioSummary.totalMarketValueUSD > 0 ? (staleValue / portfolioSummary.totalMarketValueUSD) * 100 : 0;

  // Chart styling parameters based on return or value
  const latestTrendPoint = portfolioTrend[portfolioTrend.length - 1];
  const isTrendPositive = metric === 'VALUE' ? true : (latestTrendPoint ? latestTrendPoint.gainPct >= 0 : true);
  const strokeColor = metric === 'VALUE' ? '#2563eb' : (isTrendPositive ? '#10b981' : '#f43f5e');

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Overall Return</h2>
            <div className={`text-4xl font-bold ${portfolioSummary.unrealizedGainUSD >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {portfolioSummary.unrealizedGainUSD >= 0 ? '+' : ''}{formatPercentage(portfolioSummary.capitalGrowthPct)}
            </div>
            <div className="text-slate-500 mt-1">
              {portfolioSummary.unrealizedGainUSD >= 0 ? '+' : ''}{formatMoney(portfolioSummary.unrealizedGainUSD, 'USD')}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-800">Portfolio Trend</h3>
              <div className="flex bg-slate-100 rounded-lg p-0.5 mt-1 self-start">
                <button
                  onClick={() => setMetric('VALUE')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${metric === 'VALUE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Value
                </button>
                <button
                  onClick={() => setMetric('RETURN')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${metric === 'RETURN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Return (%)
                </button>
              </div>
            </div>
            
            <div className="flex bg-slate-100 rounded-lg p-0.5 space-x-1 self-start sm:self-center">
              {(['1M', '3M', '6M', '1Y'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setChartRange(range)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${chartRange === range ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={strokeColor} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  tickFormatter={(val) => metric === 'VALUE' ? `$${(val/1000).toFixed(0)}k` : `${val >= 0 ? '+' : ''}${val.toFixed(0)}%`} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
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
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
               <span className="text-[10px] text-slate-400 border border-slate-200 px-2 py-0.5 rounded">Historical Portfolio Performance</span>
            </div>
          </div>

          <div className="h-4 w-full flex rounded-full overflow-hidden bg-slate-100">
             {/* Visualizing Basis vs Gain */}
             <div className="bg-slate-800 h-full" style={{ width: `${Math.min(100, (portfolioSummary.totalCostBasisUSD / portfolioSummary.totalMarketValueUSD) * 100)}%` }} title="Cost Basis" />
             {portfolioSummary.unrealizedGainUSD > 0 && (
                <div className="bg-emerald-500 h-full flex-1" title="Unrealized Gain" />
             )}
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>Basis: {formatMoney(portfolioSummary.totalCostBasisUSD, 'USD')}</span>
            <span>Value: {formatMoney(portfolioSummary.totalMarketValueUSD, 'USD')}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Growth by Country" />
        <CardContent className="space-y-4">
          {countryData.map(c => (
            <div key={c.country} className="flex flex-col">
              <div className="flex justify-between items-end mb-1">
                <span className="text-sm font-medium text-slate-900">{c.country}</span>
                <span className={`text-sm font-bold ${c.growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {c.growth >= 0 ? '+' : ''}{c.growth.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-slate-500">{formatMoney(c.value, 'USD')}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Allocation by Sector" />
        <CardContent>
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
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {sectorData.map((s, idx) => (
              <div key={s.sector} className="flex justify-between items-center text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-slate-800">{s.sector}</span>
                </div>
                <span className="font-medium text-slate-900">{s.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {stalePct > 0 && (
        <Card className="border-amber-200">
          <CardHeader title="Data Quality Impact" />
          <CardContent>
            <StatBox label="Value relying on stale prices" value={formatMoney(staleValue, 'USD')} valueClass="text-amber-700" subLabel={`${stalePct.toFixed(1)}% of total portfolio`} />
          </CardContent>
        </Card>
      )}

    </div>
  );
};
