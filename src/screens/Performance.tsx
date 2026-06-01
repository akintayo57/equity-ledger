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

  // Calculates total portfolio value in USD on a specific date based on transactions ledger
  const getPortfolioValueOnDate = (dateStr: string) => {
    const txsUpToDate = transactions.filter(t => t.date <= dateStr);
    if (txsUpToDate.length === 0) return 0;

    // Sum shares owned on that date
    const holdingsMap = new Map<string, number>();
    txsUpToDate.forEach(tx => {
      if (tx.type === 'DIVIDEND' || tx.type === 'FEE') return;
      const currentShares = holdingsMap.get(tx.securityId) || 0;
      if (tx.type === 'BUY') {
        holdingsMap.set(tx.securityId, currentShares + tx.shares);
      } else if (tx.type === 'SELL') {
        holdingsMap.set(tx.securityId, Math.max(0, currentShares - tx.shares));
      }
    });

    let totalValueUSD = 0;
    holdingsMap.forEach((shares, secId) => {
      if (shares <= 0) return;
      const sec = securities.find(s => s.id === secId);
      if (!sec) return;

      // Find price on or before dateStr
      const matchPrices = prices
        .filter(p => p.securityId === secId && p.date <= dateStr)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const price = matchPrices.length > 0 ? matchPrices[0].price : 0;

      // Find FX rate on or before dateStr
      let fxRate = 1;
      if (sec.currency !== 'USD') {
        const matchFX = fxRates
          .filter(fx => fx.fromCurrency === 'USD' && fx.toCurrency === sec.currency && fx.date <= dateStr)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        fxRate = matchFX.length > 0 ? matchFX[0].rate : 1;
      }
      const fxRateToUSD = 1 / fxRate;

      const valLocal = shares * price;
      const valUSD = valLocal * fxRateToUSD;
      totalValueUSD += valUSD;
    });

    return Number(totalValueUSD.toFixed(2));
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
      const value = getPortfolioValueOnDate(dateStr);
      data.push({
        month: getLabel(d),
        value: value,
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
          
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-sm text-slate-800">Portfolio Trend</h3>
            <div className="flex bg-slate-100 rounded-lg p-0.5 space-x-1">
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
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatMoney(value, 'USD'), 'Portfolio Value']}
                  labelStyle={{ display: 'none' }}
                />
                <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
               <span className="text-[10px] text-slate-400 border border-slate-200 px-2 py-0.5 rounded">Trend (Simulated)</span>
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
