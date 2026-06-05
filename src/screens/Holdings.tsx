import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Card, CardContent, Badge } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, AlertTriangle, Heart, Plus, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays } from 'date-fns';
import { Security } from '../types';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

// Reusable helper to resolve exchange info
const getExchangeInfoHelper = (sec: Security, exchanges: any[]) => {
  const ex = exchanges.find(e => e.id === sec.exchangeId);
  return {
    country: ex ? ex.country : 'Unknown',
    currency: sec.currency || (ex ? ex.currency : 'USD'),
    exchangeName: ex ? ex.name : (sec.exchangeId || 'Unknown')
  };
};

// Reusable helper to get latest price
const getLatestPriceHelper = (securityId: string, prices: any[]) => {
  const secPrices = prices
    .filter(p => p.securityId === securityId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return secPrices.length > 0 ? secPrices[0].price : 0;
};

// Component 1: Holdings List Tab
export const HoldingsList = () => {
  const { holdings, securities, watchlist, prices, exchanges, toggleWatchlist } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  // Filter all securities matching the search term
  const portfolioItems = useMemo(() => {
    if (searchTerm === '') {
      return holdings.map(h => ({ type: 'owned' as const, holding: h, security: h.security }));
    }
    
    const term = searchTerm.toLowerCase();
    const matching = securities.filter(s => 
      s.companyName.toLowerCase().includes(term) || 
      s.ticker.toLowerCase().includes(term)
    );
    
    return matching.map(s => {
      const h = holdings.find(item => item.security.id === s.id);
      if (h) {
        return { type: 'owned' as const, holding: h, security: s };
      }
      return { type: 'market' as const, holding: null, security: s };
    });
  }, [securities, holdings, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search holdings and market..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 cursor-pointer">
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Cards List */}
      <div className="space-y-3">
        {portfolioItems.map((item) => {
          if (item.type === 'owned') {
            const h = item.holding!;
            const isStale = h.priceStaleStatus === 'STALE' || h.priceStaleStatus === 'VERY_STALE';
            const isGreen = h.unrealizedGainLossPctUSD >= 0;
            const isWatched = watchlist.includes(h.security.id);
            const info = getExchangeInfoHelper(h.security, exchanges);
            
            return (
              <Link to={`/holdings/${h.security.id}`} key={h.security.id} className="block">
                <Card className="hover:border-blue-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{h.security.ticker}</span>
                          {isStale && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" title="Price is stale" />}
                          {h.hasUncertainty && (
                            <span className="flex items-center text-amber-600 text-[9px] bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider" title="Cost basis estimated.">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5 text-amber-500" />
                              Est.
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[180px]">
                          {h.security.companyName}
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-2">
                        <div className="text-right">
                          <div className="font-bold text-slate-900">{formatMoney(h.marketValueUSD, 'USD')}</div>
                          <div className="text-xs text-slate-500">{formatMoney(h.marketValueLocal, info.currency)}</div>
                        </div>
                        <div className="flex flex-col space-y-1.5 pl-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <button
                            onClick={() => toggleWatchlist(h.security.id)}
                            className={`p-1.5 hover:bg-slate-100 rounded-lg transition-colors ${isWatched ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'} cursor-pointer`}
                            title={isWatched ? "Remove from Watchlist" : "Add to Watchlist"}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isWatched ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </button>
                           <button
                             onClick={() => navigate('/portfolio', { state: { activeTab: 'SUMMARY', showAdd: true, securityId: h.security.id } })}
                             className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                             title="Add Transaction"
                           >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4">
                      <div className="flex space-x-2">
                        <Badge variant="gray">{info.country}</Badge>
                        <Badge variant="gray">{h.portfolioWeight.toFixed(1)}%</Badge>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className={isGreen ? 'text-emerald-600 font-semibold text-xs' : 'text-rose-600 font-semibold text-xs'}>
                          {isGreen ? '+' : ''}{formatPercentage(h.unrealizedGainLossPctUSD)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          } else {
            // Market Asset (Not Owned)
            const s = item.security;
            const lastPrice = getLatestPriceHelper(s.id, prices);
            const isWatched = watchlist.includes(s.id);
            const info = getExchangeInfoHelper(s, exchanges);
            
            return (
              <Link to={`/holdings/${s.id}`} key={s.id} className="block">
                <Card className="hover:border-blue-300 border-dashed transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{s.ticker}</span>
                          <Badge variant="blue">Market</Badge>
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[180px]">
                          {s.companyName}
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-2">
                        <div className="text-right">
                          <div className="font-bold text-slate-900">{lastPrice > 0 ? formatMoney(lastPrice, info.currency) : 'No Price'}</div>
                          <div className="text-xs text-slate-500">{info.currency}</div>
                        </div>
                        <div className="flex flex-col space-y-1.5 pl-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <button
                            onClick={() => toggleWatchlist(s.id)}
                            className={`p-1.5 hover:bg-slate-100 rounded-lg transition-colors ${isWatched ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'} cursor-pointer`}
                            title={isWatched ? "Remove from Watchlist" : "Add to Watchlist"}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isWatched ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </button>
                          <button
                            onClick={() => navigate('/portfolio', { state: { activeTab: 'SUMMARY', showAdd: true, securityId: s.id } })}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Add Transaction"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4">
                      <div className="flex space-x-2">
                        <Badge variant="gray">{info.country}</Badge>
                        <Badge variant="gray">{s.sector}</Badge>
                      </div>
                      {s.fundamentals?.peRatio && (
                         <div className="text-xs font-semibold text-slate-500">P/E: {s.fundamentals.peRatio.toFixed(1)}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          }
        })}
        {portfolioItems.length === 0 && (
          <div className="text-center text-slate-500 py-8 text-sm">
            No equities match your search.
          </div>
        )}
      </div>
    </div>
  );
};

// Component 2: Watchlist Tab (with performance chart comparison)
export const WatchlistTab = () => {
  const { securities, watchlist, prices, exchanges, toggleWatchlist } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const watchlistSecurities = useMemo(() => {
    return securities.filter(s => watchlist.includes(s.id));
  }, [securities, watchlist]);

  // Dynamic watchlist comparison graph data
  const watchlistChartData = useMemo(() => {
    if (watchlistSecurities.length === 0) return [];
    
    const dateIntervals: string[] = [];
    for (let i = 12; i >= 0; i--) {
      const d = subDays(new Date(), i * 14);
      dateIntervals.push(d.toISOString().split('T')[0]);
    }

    const getPriceOnDate = (secId: string, dateStr: string) => {
      const match = prices
        .filter(p => p.securityId === secId && p.date <= dateStr)
        .sort((a, b) => b.date.localeCompare(a.date));
      if (match.length > 0) return match[0].price;
      
      const allSecPrices = prices
        .filter(p => p.securityId === secId)
        .sort((a, b) => a.date.localeCompare(b.date));
      return allSecPrices.length > 0 ? allSecPrices[0].price : 0;
    };

    return dateIntervals.map(dateStr => {
      const row: any = { date: format(new Date(dateStr), 'MMM d') };
      watchlistSecurities.forEach(sec => {
        const p0 = getPriceOnDate(sec.id, dateIntervals[0]);
        const pt = getPriceOnDate(sec.id, dateStr);
        const changePct = p0 > 0 ? ((pt - p0) / p0) * 100 : 0;
        row[sec.ticker] = Number(changePct.toFixed(1));
      });
      return row;
    });
  }, [watchlistSecurities, prices]);

  const watchlistItems = useMemo(() => {
    if (searchTerm === '') {
      return securities.filter(s => watchlist.includes(s.id)).map(s => ({ type: 'watchlisted' as const, security: s }));
    }

    const term = searchTerm.toLowerCase();
    const matching = securities.filter(s => 
      s.companyName.toLowerCase().includes(term) || 
      s.ticker.toLowerCase().includes(term)
    );

    return matching.map(s => {
      const isWatched = watchlist.includes(s.id);
      return {
        type: isWatched ? ('watchlisted' as const) : ('market' as const),
        security: s
      };
    });
  }, [securities, watchlist, searchTerm]);

  return (
    <div className="space-y-4">
      {/* Watchlist Comparison Chart */}
      {watchlistSecurities.length > 0 && (
        <Card className="bg-white">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-3 border-b border-slate-100 pb-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-slate-850 text-xs uppercase tracking-wider">Watchlist Price Performance (% Change, 6M)</h3>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={watchlistChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: '#64748b' }} 
                    tickFormatter={(val) => `${val >= 0 ? '+' : ''}${val}%`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                    labelStyle={{ fontSize: '10px', color: '#64748b', marginBottom: '3px' }}
                    formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value}%`, 'Change']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  {watchlistSecurities.map((sec, idx) => (
                    <Line 
                      key={sec.id}
                      type="monotone"
                      dataKey={sec.ticker}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Input */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search watchlist and market..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 cursor-pointer">
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Watchlist Cards */}
      <div className="space-y-3">
        {watchlistItems.map((item) => {
          const s = item.security;
          const lastPrice = getLatestPriceHelper(s.id, prices);
          const isWatched = watchlist.includes(s.id);
          const info = getExchangeInfoHelper(s, exchanges);

          if (item.type === 'watchlisted') {
            return (
              <Link to={`/holdings/${s.id}`} state={{ fromWatchlist: true }} key={s.id} className="block">
                <Card className="hover:border-blue-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-slate-900">{s.ticker}</span>
                        <div className="text-xs text-slate-500 truncate max-w-[200px] mt-0.5">
                          {s.companyName}
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-2">
                        <div className="text-right">
                          <div className="font-bold text-slate-900">{lastPrice > 0 ? formatMoney(lastPrice, info.currency) : 'No Price'}</div>
                          <div className="text-xs text-slate-500">{info.currency}</div>
                        </div>
                        <div className="flex flex-col space-y-1.5 pl-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <button
                            onClick={() => toggleWatchlist(s.id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-rose-500 transition-colors cursor-pointer"
                            title="Remove from Watchlist"
                          >
                            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                          </button>
                          <button
                            onClick={() => navigate('/portfolio', { state: { activeTab: 'SUMMARY', showAdd: true, securityId: s.id } })}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Add Transaction"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4">
                      <div className="flex space-x-2">
                        <Badge variant="gray">{info.country}</Badge>
                        <Badge variant="gray">{s.sector}</Badge>
                      </div>
                      {s.fundamentals?.peRatio && (
                         <div className="text-xs font-semibold text-slate-500">P/E: {s.fundamentals.peRatio.toFixed(1)}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          } else {
            // Market Item (Add to Watchlist Search Results)
            return (
              <Link to={`/holdings/${s.id}`} state={{ fromWatchlist: true }} key={s.id} className="block">
                <Card className="hover:border-blue-300 border-dashed transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{s.ticker}</span>
                          <Badge variant="blue">Market</Badge>
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[200px] mt-0.5">
                          {s.companyName}
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-2">
                        <div className="text-right">
                          <div className="font-bold text-slate-900">{lastPrice > 0 ? formatMoney(lastPrice, info.currency) : 'No Price'}</div>
                          <div className="text-xs text-slate-500">{info.currency}</div>
                        </div>
                        <div className="flex flex-col space-y-1.5 pl-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <button
                            onClick={() => toggleWatchlist(s.id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Add to Watchlist"
                          >
                            <Heart className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          <button
                            onClick={() => navigate('/portfolio', { state: { activeTab: 'SUMMARY', showAdd: true, securityId: s.id } })}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Add Transaction"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4">
                      <div className="flex space-x-2">
                        <Badge variant="gray">{info.country}</Badge>
                        <Badge variant="gray">{s.sector}</Badge>
                      </div>
                      {s.fundamentals?.peRatio && (
                         <div className="text-xs font-semibold text-slate-500">P/E: {s.fundamentals.peRatio.toFixed(1)}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          }
        })}
        {watchlistItems.length === 0 && (
          <div className="text-center text-slate-500 py-8 text-sm">
            Watchlist is empty. Search above to add stocks to your watchlist.
          </div>
        )}
      </div>
    </div>
  );
};
