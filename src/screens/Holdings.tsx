import { useState } from 'react';
import { useStore } from '../store';
import { Card, CardContent, Badge } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, AlertTriangle, Eye, Heart, Plus } from 'lucide-react';

export const Holdings = () => {
  const { holdings, securities, watchlist, prices, toggleWatchlist } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'PORTFOLIO' | 'WATCHLIST'>('PORTFOLIO');
  const navigate = useNavigate();

  // Helper to get latest price
  const getLatestPrice = (securityId: string) => {
    const secPrices = prices
      .filter(p => p.securityId === securityId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return secPrices.length > 0 ? secPrices[0].price : 0;
  };

  // Filter all securities matching the search term
  const matchingSecurities = securities.filter(s => 
    s.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dynamic lists mapping depending on search status
  const portfolioItems = searchTerm === '' 
    ? holdings.map(h => ({ type: 'owned' as const, holding: h, security: h.security }))
    : matchingSecurities.map(s => {
        const h = holdings.find(item => item.security.id === s.id);
        if (h) {
          return { type: 'owned' as const, holding: h, security: s };
        }
        return { type: 'market' as const, holding: null, security: s };
      });

  const watchlistItems = searchTerm === ''
    ? securities
        .filter(s => watchlist.includes(s.id))
        .map(s => ({ type: 'watchlisted' as const, security: s }))
    : matchingSecurities.map(s => {
        const isWatched = watchlist.includes(s.id);
        return {
          type: isWatched ? ('watchlisted' as const) : ('market' as const),
          security: s
        };
      });

  return (
    <div className="space-y-4">
      {/* 2-Column Tab Selector */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200 rounded-lg mb-4">
        <button 
          className={`py-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'PORTFOLIO' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          onClick={() => setActiveTab('PORTFOLIO')}
        >
          Portfolio
        </button>
        <button 
          className={`py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center space-x-1 ${activeTab === 'WATCHLIST' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          onClick={() => setActiveTab('WATCHLIST')}
        >
          <Eye className="w-3.5 h-3.5 mr-1" />
          Watchlist
        </button>
      </div>

      {/* Unified Search Input */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'PORTFOLIO' 
                ? "Search holdings and market..." 
                : "Search watchlist and market..."
            }
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-600">
          <Filter className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {/* TAB 1: PORTFOLIO */}
        {activeTab === 'PORTFOLIO' && (
          portfolioItems.map((item) => {
            if (item.type === 'owned') {
              const h = item.holding!;
              const isStale = h.priceStaleStatus === 'STALE' || h.priceStaleStatus === 'VERY_STALE';
              const isGreen = h.unrealizedGainLossPctUSD >= 0;
              const isWatched = watchlist.includes(h.security.id);
              
              return (
                <Link to={`/holdings/${h.security.id}`} key={h.security.id} className="block">
                  <Card className="hover:border-blue-300 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{h.security.ticker}</span>
                            {isStale && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                          </div>
                          <div className="text-xs text-slate-500 truncate max-w-[180px]">
                            {h.security.companyName}
                          </div>
                        </div>
                        
                        {/* Interactive Controls & Value */}
                        <div className="flex items-start space-x-2">
                          <div className="text-right">
                            <div className="font-bold text-slate-900">{formatMoney(h.marketValueUSD, 'USD')}</div>
                            <div className="text-xs text-slate-500">{formatMoney(h.marketValueLocal, h.security.currency)}</div>
                          </div>
                          <div className="flex flex-col space-y-1.5 pl-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                            <button
                              onClick={() => toggleWatchlist(h.security.id)}
                              className={`p-1.5 hover:bg-slate-100 rounded-lg transition-colors ${isWatched ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                              title={isWatched ? "Remove from Watchlist" : "Add to Watchlist"}
                            >
                              <Heart className={`w-3.5 h-3.5 ${isWatched ? 'fill-rose-500' : ''}`} />
                            </button>
                            <button
                              onClick={() => navigate('/transactions', { state: { showAdd: true, securityId: h.security.id } })}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                              title="Add Transaction"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-end mt-4">
                        <div className="flex space-x-2">
                          <Badge variant="gray">{h.security.country}</Badge>
                          <Badge variant="gray">{h.portfolioWeight.toFixed(1)}%</Badge>
                        </div>
                        <div className="text-right">
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
              // Market Result (Not Owned)
              const s = item.security;
              const lastPrice = getLatestPrice(s.id);
              const isWatched = watchlist.includes(s.id);
              
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
                            <div className="font-bold text-slate-900">{lastPrice > 0 ? formatMoney(lastPrice, s.currency) : 'No Price'}</div>
                            <div className="text-xs text-slate-500">{s.currency}</div>
                          </div>
                          <div className="flex flex-col space-y-1.5 pl-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                            <button
                              onClick={() => toggleWatchlist(s.id)}
                              className={`p-1.5 hover:bg-slate-100 rounded-lg transition-colors ${isWatched ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                              title={isWatched ? "Remove from Watchlist" : "Add to Watchlist"}
                            >
                              <Heart className={`w-3.5 h-3.5 ${isWatched ? 'fill-rose-500' : ''}`} />
                            </button>
                            <button
                              onClick={() => navigate('/transactions', { state: { showAdd: true, securityId: s.id } })}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                              title="Add Transaction"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-end mt-4">
                        <div className="flex space-x-2">
                          <Badge variant="gray">{s.country}</Badge>
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
          })
        )}

        {/* TAB 2: WATCHLIST */}
        {activeTab === 'WATCHLIST' && (
          watchlistItems.map((item) => {
            const s = item.security;
            const lastPrice = getLatestPrice(s.id);
            const isWatched = watchlist.includes(s.id);

            if (item.type === 'watchlisted') {
              return (
                <Link to={`/holdings/${s.id}`} key={s.id} className="block">
                  <Card className="hover:border-blue-300 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-bold text-slate-900">{s.ticker}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">
                            {s.companyName}
                          </div>
                        </div>
                        
                        {/* Price & Action */}
                        <div className="flex items-start space-x-2">
                          <div className="text-right">
                            <div className="font-bold text-slate-900">{lastPrice > 0 ? formatMoney(lastPrice, s.currency) : 'No Price'}</div>
                            <div className="text-xs text-slate-500">{s.currency}</div>
                          </div>
                          <div className="flex flex-col space-y-1.5 pl-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                            <button
                              onClick={() => toggleWatchlist(s.id)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-rose-500 transition-colors"
                              title="Remove from Watchlist"
                            >
                              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                            </button>
                            <button
                              onClick={() => navigate('/transactions', { state: { showAdd: true, securityId: s.id } })}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                              title="Add Transaction"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-end mt-4">
                        <div className="flex space-x-2">
                          <Badge variant="gray">{s.country}</Badge>
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
              // Market Result (Not in Watchlist)
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
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">
                            {s.companyName}
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-2">
                          <div className="text-right">
                            <div className="font-bold text-slate-900">{lastPrice > 0 ? formatMoney(lastPrice, s.currency) : 'No Price'}</div>
                            <div className="text-xs text-slate-500">{s.currency}</div>
                          </div>
                          <div className="flex flex-col space-y-1.5 pl-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                            <button
                              onClick={() => toggleWatchlist(s.id)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                              title="Add to Watchlist"
                            >
                              <Heart className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                            <button
                              onClick={() => navigate('/transactions', { state: { showAdd: true, securityId: s.id } })}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                              title="Add Transaction"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-end mt-4">
                        <div className="flex space-x-2">
                          <Badge variant="gray">{s.country}</Badge>
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
          })
        )}
        
        {/* Fallbacks */}
        {activeTab === 'PORTFOLIO' && portfolioItems.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            {searchTerm === '' ? 'No holdings found.' : 'No equities match your search.'}
          </div>
        )}
        
        {activeTab === 'WATCHLIST' && watchlistItems.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            {searchTerm === '' ? 'Watchlist is empty.' : 'No equities match your search.'}
          </div>
        )}
      </div>
    </div>
  );
};
