import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { Card, CardHeader, CardContent, StatBox, Badge } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { ArrowLeft, Clock, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo, useState } from 'react';

export const HoldingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { holdings, transactions, securities, prices, watchlist, toggleWatchlist } = useStore();

  const holding = holdings.find((h) => h.security.id === id);
  const security = holding?.security || securities.find(s => s.id === id);

  if (!security) {
    return <div className="p-4">Security not found.</div>;
  }

  const isWatched = watchlist.includes(security.id);

  const holdingTxs = transactions
    .filter((tx) => tx.securityId === id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const isGreen = holding ? holding.unrealizedGainLossPctUSD >= 0 : true;
  const isStale = holding ? holding.priceStaleStatus === 'STALE' || holding.priceStaleStatus === 'VERY_STALE' : false;

  const secPrices = prices.filter(p => p.securityId === security.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastPrice = secPrices.length > 0 ? secPrices[0].price : 0;
  const lastPriceDate = secPrices.length > 0 ? secPrices[0].date : null;

  const [chartRange, setChartRange] = useState<'1M' | '3M' | '6M' | '1Y'>('6M');

  const priceHistory = useMemo(() => {
    let daysToLookBack = 180;
    let getLabel = (d: Date) => format(d, 'MMM dd');

    if (chartRange === '1M') { daysToLookBack = 30; getLabel = (d: Date) => format(d, 'dd MMM'); }
    else if (chartRange === '3M') { daysToLookBack = 90; getLabel = (d: Date) => format(d, 'dd MMM'); }
    else if (chartRange === '6M') { daysToLookBack = 180; getLabel = (d: Date) => format(d, 'MMM yy'); }
    else if (chartRange === '1Y') { daysToLookBack = 365; getLabel = (d: Date) => format(d, 'MMM yy'); }

    const startDate = new Date(Date.now() - daysToLookBack * 86400000);
    
    // Get actual stored prices and sort chronologically
    const filteredRealData = secPrices
      .filter(p => new Date(p.date) >= startDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (filteredRealData.length > 0) {
      const data = filteredRealData.map(p => ({
        date: getLabel(new Date(p.date)),
        price: p.price
      }));

      // Prepend start date fallback to render a flat line if only one price exists
      if (data.length === 1) {
        return [
          { date: getLabel(startDate), price: data[0].price },
          data[0]
        ];
      }
      return data;
    }

    const fallbackPrice = lastPrice || 0;
    return [
      { date: getLabel(startDate), price: fallbackPrice },
      { date: getLabel(new Date()), price: fallbackPrice }
    ];
  }, [secPrices, lastPrice, chartRange]);

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full border border-slate-200 shadow-sm">
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">{security.ticker}</h2>
            <div className="text-xs text-slate-500">{security.companyName}</div>
          </div>
        </div>
        <button 
          onClick={() => toggleWatchlist(security.id)} 
          className={`p-2 rounded-full border shadow-sm transition-colors ${isWatched ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}
        >
          {isWatched ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Value Card (Only if holding exists) */}
      {holding && (
        <>
          <Card className="bg-slate-900 border-slate-800 text-white shadow-md">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Market Value (USD)</div>
                  <div className="text-3xl font-bold">{formatMoney(holding.marketValueUSD, 'USD')}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Return</div>
                  <div className={isGreen ? 'text-emerald-400 text-lg font-bold' : 'text-rose-400 text-lg font-bold'}>
                    {isGreen ? '+' : ''}{formatPercentage(holding.unrealizedGainLossPctUSD)}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 border-t border-slate-700 pt-4 mt-4">
                <div>
                  <div className="text-slate-400 text-xs mb-1">Local Value ({security.currency})</div>
                  <div className="font-medium">{formatMoney(holding.marketValueLocal, security.currency)}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-xs mb-1">Cost Basis (USD)</div>
                  <div className="font-medium">{formatMoney(holding.totalCostBasisUSD, 'USD')}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <StatBox label="Shares Owned" value={holding.sharesOwned.toLocaleString()} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <StatBox label="Avg Cost" value={formatMoney(holding.averageCost, security.currency)} subLabel={security.currency} />
              </CardContent>
            </Card>
          </div>

          {holding.hasUncertainty && (
            <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex items-start space-x-3 text-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold">Estimated Cost Basis & Returns</div>
                <p className="text-slate-600 leading-normal">
                  This holding contains inherited shares or transactions that predate the stock exchange with unknown purchase details. The cost basis and unrealized gain/loss calculations shown here are estimates based on a zero-cost assumption for these items.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Price Status & History Chart */}
      <Card className={isStale ? 'border-amber-200 bg-amber-50' : ''}>
        <CardContent className="p-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-start space-x-3">
            {isStale ? <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" /> : <Clock className="w-5 h-5 text-slate-400 shrink-0" />}
            <div>
              <div className="text-sm font-semibold text-slate-800">
                Last Price: {formatMoney(lastPrice, security.currency)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                As of {lastPriceDate ? format(new Date(lastPriceDate), 'MMM d, yyyy') : 'Unknown'}
                {holding && isStale && <span className="text-amber-600 font-medium ml-1">({holding.priceStaleStatus.replace('_', ' ').toLowerCase()})</span>}
              </div>
            </div>
          </div>
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
        </CardContent>
        <div className="p-4 h-48 w-full bg-white">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priceHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} minTickGap={15} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} tickFormatter={(val) => val.toFixed(0)} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}
                itemStyle={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}
                formatter={(value: number) => [`${security.currency} ${value.toFixed(2)}`, 'Price']}
              />
              <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Fundamentals */}
      {security.fundamentals && (
        <Card>
          <CardHeader title="Fundamentals" action={<span className="text-[10px] text-slate-400 border border-slate-200 px-2 py-0.5 rounded">As of {security.fundamentals.lastUpdated}</span>} />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              <div className="p-3 flex justify-between text-sm">
                <span className="text-slate-500">P/E Ratio</span>
                <span className="font-medium text-slate-900">{security.fundamentals.peRatio?.toFixed(1) || 'N/A'}</span>
              </div>
              <div className="p-3 flex justify-between text-sm">
                <span className="text-slate-500">EPS</span>
                <span className="font-medium text-slate-900">{security.fundamentals.eps ? formatMoney(security.fundamentals.eps, security.currency) : 'N/A'}</span>
              </div>
              <div className="p-3 flex justify-between text-sm">
                <span className="text-slate-500">Div. Yield</span>
                <span className="font-medium text-slate-900">{security.fundamentals.dividendYield ? `${security.fundamentals.dividendYield.toFixed(1)}%` : 'N/A'}</span>
              </div>
              <div className="p-3 flex justify-between text-sm">
                <span className="text-slate-500">P/B Ratio</span>
                <span className="font-medium text-slate-900">{security.fundamentals.pbRatio?.toFixed(1) || 'N/A'}</span>
              </div>
              <div className="p-3 flex justify-between text-sm">
                <span className="text-slate-500">ROE</span>
                <span className="font-medium text-slate-900">{security.fundamentals.roe ? `${security.fundamentals.roe.toFixed(1)}%` : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details */}
      <Card>
        <CardHeader title="Security Info" />
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            <div className="p-3 flex justify-between text-sm">
              <span className="text-slate-500">Exchange</span>
              <span className="font-medium text-slate-900">{security.exchange}</span>
            </div>
            <div className="p-3 flex justify-between text-sm">
              <span className="text-slate-500">Country</span>
              <span className="font-medium text-slate-900">{security.country}</span>
            </div>
            <div className="p-3 flex justify-between text-sm">
              <span className="text-slate-500">Sector</span>
              <span className="font-medium text-slate-900">{security.sector}</span>
            </div>
            {holding && (
              <div className="p-3 flex justify-between text-sm">
                <span className="text-slate-500">Portfolio Weight</span>
                <span className="font-medium text-slate-900">{formatPercentage(holding.portfolioWeight)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      {holdingTxs.length > 0 && (
        <Card>
          <CardHeader title="Recent Transactions" />
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {holdingTxs.map((tx) => (
                <div key={tx.id} className="p-3 flex justify-between items-center text-sm">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className={`font-medium ${
                        tx.type === 'BUY' 
                          ? 'text-emerald-700' 
                          : tx.type === 'SELL' 
                          ? 'text-rose-700' 
                          : tx.type === 'INHERIT'
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}>
                        {tx.type}
                      </span>
                      {tx.isUncertain && (
                        <span className="flex items-center text-[9px] font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded" title="This transaction has uncertain purchase information (e.g. predates exchange)">
                          Uncertain
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{format(new Date(tx.date), 'MMM d, yyyy')}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-slate-900">{tx.shares} shs</div>
                    <div className="text-xs text-slate-500">
                      {tx.type === 'INHERIT' ? 'Inherited / Unknown' : `@ ${formatMoney(tx.pricePerShare, tx.currency)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
