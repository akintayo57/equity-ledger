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

const getFlagByExchangeId = (exchangeId: string) => {
  const flags: Record<string, string> = {
    GASCI: '🇬🇾',
    BSE: '🇧🇧',
    JSE: '🇯🇲',
    TTSE: '🇹🇹',
    ECSE: '🇰🇳'
  };
  return flags[exchangeId] || '🌐';
};

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
    const activeHoldings = holdings.filter(h => h.sharesOwned > 0);
    if (searchTerm === '') {
      return activeHoldings.map(h => ({ type: 'owned' as const, holding: h, security: h.security }));
    }
    
    const term = searchTerm.toLowerCase();
    const matching = securities.filter(s => 
      s.companyName.toLowerCase().includes(term) || 
      s.ticker.toLowerCase().includes(term)
    );
    
    return matching.map(s => {
      const h = activeHoldings.find(item => item.security.id === s.id);
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
                          {h.security.status === 'INACTIVE' && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-650 border border-slate-200">
                              Defunct
                            </span>
                          )}
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
                          {s.status === 'INACTIVE' && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-650 border border-slate-200">
                              Defunct
                            </span>
                          )}
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

// Component 2: Watchlist Tab
export const WatchlistTab = () => {
  const { securities, watchlist, prices, exchanges, toggleWatchlist } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

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
      {/* Search Input */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search watchlist and market..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-650 cursor-pointer">
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

          // Get price history for the security
          const secPrices = prices
            .filter(p => p.securityId === s.id)
            .sort((a, b) => a.date.localeCompare(b.date)); // chronological

          const oldestDate = secPrices.length > 0 ? secPrices[0].date : '';
          const daysOfHistory = oldestDate ? Math.floor((Date.now() - new Date(oldestDate).getTime()) / 86400000) : 0;
          const hasShortHistory = daysOfHistory < 365;

          const oneYearAgoStr = subDays(new Date(), 365).toISOString().split('T')[0];
          const sparklinePrices = secPrices.filter(p => p.date >= oneYearAgoStr);
          const sparklineData = sparklinePrices.map(p => ({
            date: p.date,
            price: p.price
          }));

          if (sparklineData.length === 1) {
            sparklineData.unshift({
              date: subDays(new Date(sparklineData[0].date), 30).toISOString().split('T')[0],
              price: sparklineData[0].price
            });
          } else if (sparklineData.length === 0) {
            const latestPrice = lastPrice || 0;
            sparklineData.push(
              { date: subDays(new Date(), 30).toISOString().split('T')[0], price: latestPrice },
              { date: new Date().toISOString().split('T')[0], price: latestPrice }
            );
          }

          const pStart = sparklineData[0].price;
          const pEnd = sparklineData[sparklineData.length - 1].price;
          const growthPct = pStart > 0 ? ((pEnd - pStart) / pStart) * 100 : 0;

          if (item.type === 'watchlisted') {
            return (
              <Link to={`/holdings/${s.id}`} state={{ fromWatchlist: true }} key={s.id} className="block">
                <Card className="hover:border-blue-300 dark:hover:border-blue-400 transition-colors bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-100 dark:border-slate-800 shadow-xs">
                  <CardContent className="p-4 flex items-center justify-between space-x-3">
                    {/* Left: Ticker & Name */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-base select-none">{getFlagByExchangeId(s.exchangeId)}</span>
                        <span className="font-bold text-slate-900 dark:text-white tracking-tight">{s.ticker}</span>
                        {s.status === 'INACTIVE' && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-405 border border-slate-200 dark:border-slate-700/30">
                            Defunct
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[120px] sm:max-w-[180px] mt-0.5 font-medium">
                        {s.companyName}
                      </div>
                    </div>

                    {/* Center: Sparkline */}
                    <div className="w-20 sm:w-28 h-8 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparklineData}>
                          <Line
                            type="monotone"
                            dataKey="price"
                            stroke={growthPct >= 0 ? '#10b981' : '#ef4444'}
                            strokeWidth={1.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Right: Latest Price & Performance */}
                    <div className="text-right shrink-0 flex items-center space-x-3.5">
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
                          {lastPrice > 0 ? formatMoney(lastPrice, info.currency) : 'No Price'}
                        </div>
                        <div className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5 flex items-center justify-end space-x-1">
                          {hasShortHistory && (
                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" title="Short history (< 1 year)" />
                          )}
                          <span className={`font-bold ${growthPct >= 0 ? 'text-emerald-650 dark:text-emerald-450' : 'text-rose-600 dark:text-rose-455'}`}>
                            {growthPct >= 0 ? '+' : ''}{growthPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Watchlist Toggle / Heart Action */}
                      <div className="flex flex-col space-y-1.5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <button
                          onClick={() => toggleWatchlist(s.id)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-rose-500 transition-colors cursor-pointer"
                          title="Remove from Watchlist"
                        >
                          <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          } else {
            // Market Item (Add to Watchlist Search Results)
            return (
              <Link to={`/holdings/${s.id}`} state={{ fromWatchlist: true }} key={s.id} className="block">
                <Card className="hover:border-blue-300 border-dashed dark:hover:border-blue-400 transition-colors bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-100 dark:border-slate-800 shadow-xs">
                  <CardContent className="p-4 flex items-center justify-between space-x-3">
                    {/* Left: Ticker & Name */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-base select-none">{getFlagByExchangeId(s.exchangeId)}</span>
                        <span className="font-bold text-slate-900 dark:text-white tracking-tight">{s.ticker}</span>
                        {s.status === 'INACTIVE' && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-405 border border-slate-200 dark:border-slate-700/30">
                            Defunct
                          </span>
                        )}
                        <Badge variant="blue">Market</Badge>
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[120px] sm:max-w-[180px] mt-0.5 font-medium">
                        {s.companyName}
                      </div>
                    </div>

                    {/* Center: Sparkline */}
                    <div className="w-20 sm:w-28 h-8 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparklineData}>
                          <Line
                            type="monotone"
                            dataKey="price"
                            stroke={growthPct >= 0 ? '#10b981' : '#ef4444'}
                            strokeWidth={1.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Right: Latest Price & Performance */}
                    <div className="text-right shrink-0 flex items-center space-x-3.5">
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
                          {lastPrice > 0 ? formatMoney(lastPrice, info.currency) : 'No Price'}
                        </div>
                        <div className="text-[10px] text-slate-455 dark:text-slate-500 mt-0.5 flex items-center justify-end space-x-1">
                          {hasShortHistory && (
                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" title="Short history (< 1 year)" />
                          )}
                          <span className={`font-bold ${growthPct >= 0 ? 'text-emerald-650 dark:text-emerald-450' : 'text-rose-600 dark:text-rose-455'}`}>
                            {growthPct >= 0 ? '+' : ''}{growthPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Watchlist Toggle / Heart Action */}
                      <div className="flex flex-col space-y-1.5" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <button
                          onClick={() => toggleWatchlist(s.id)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Add to Watchlist"
                        >
                          <Heart className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
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
