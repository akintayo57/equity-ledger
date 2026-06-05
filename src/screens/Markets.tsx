import { useStore } from '../store';
import { Card, CardContent, Badge } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { Star, TrendingUp, Newspaper, HelpCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

export const Markets = () => {
  const { 
    securities, 
    prices, 
    exchanges,
    equityNotes,
    watchlist, 
    toggleWatchlist 
  } = useStore();

  const [selectedExchange, setSelectedExchange] = useState<'ALL' | 'GASCI' | 'BSE' | 'JSE' | 'TTSE'>('ALL');

  // Helper to resolve security currency
  const getSecurityCurrency = (sec: any) => {
    if (sec.currency) return sec.currency;
    const ex = exchanges.find(e => e.id === sec.exchangeId);
    return ex ? ex.currency : 'USD';
  };

  // Dynamic Index calculations for all four exchanges
  const indices = useMemo(() => {
    const calculateIndex = (exchangeId: string, scale: number) => {
      const secList = securities.filter(s => s.exchangeId === exchangeId);
      if (secList.length === 0) return { value: 0, change: 0, changePct: 0 };
      
      let currentSum = 0;
      let prevSum = 0;
      let currentCount = 0;
      let prevCount = 0;
      
      secList.forEach(sec => {
        const secPrices = prices.filter(p => p.securityId === sec.id).sort((a, b) => b.date.localeCompare(a.date));
        if (secPrices.length >= 1) {
          currentSum += secPrices[0].price;
          currentCount++;
        }
        if (secPrices.length >= 2) {
          prevSum += secPrices[1].price;
          prevCount++;
        } else if (secPrices.length === 1) {
          prevSum += secPrices[0].price;
          prevCount++;
        }
      });
      
      const currentValue = currentCount > 0 ? (currentSum / currentCount) * scale : 0;
      const prevValue = prevCount > 0 ? (prevSum / prevCount) * scale : 0;
      const change = currentValue - prevValue;
      const changePct = prevValue > 0 ? (change / prevValue) * 100 : 0;
      
      return {
        value: currentValue,
        change,
        changePct
      };
    };

    return {
      GASCI: calculateIndex('GASCI', 10),
      BSE: calculateIndex('BSE', 1000),
      JSE: calculateIndex('JSE', 100),
      TTSE: calculateIndex('TTSE', 100)
    };
  }, [securities, prices]);

  // Find the latest price date for each exchange
  const latestDateByExchange = useMemo(() => {
    const dates: Record<string, string> = {};
    
    // Create a fast lookup map for security exchange IDs
    const secExchangeMap = new Map<string, string>();
    securities.forEach(s => {
      secExchangeMap.set(s.id, s.exchangeId);
    });

    prices.forEach(p => {
      const exchangeId = secExchangeMap.get(p.securityId);
      if (exchangeId) {
        if (!dates[exchangeId] || p.date.localeCompare(dates[exchangeId]) > 0) {
          dates[exchangeId] = p.date;
        }
      }
    });

    return dates;
  }, [securities, prices]);

  // Market Movers calculations for all listed stocks (strictly based on the latest session date of their exchange)
  const allMovers = useMemo(() => {
    const pricesBySec = new Map<string, typeof prices>();
    prices.forEach(p => {
      if (!pricesBySec.has(p.securityId)) {
        pricesBySec.set(p.securityId, []);
      }
      pricesBySec.get(p.securityId)!.push(p);
    });

    return securities.map(sec => {
      const secPrices = pricesBySec.get(sec.id) || [];
      const sortedPrices = [...secPrices].sort((a, b) => b.date.localeCompare(a.date));

      let currentPrice = 0;
      let prevPrice = 0;
      let change = 0;
      let changePct = 0;

      const latestExchangeSessionDate = latestDateByExchange[sec.exchangeId];

      // Only calculate movers if the stock has a price update on the latest session date for its exchange
      if (sortedPrices.length > 0 && latestExchangeSessionDate && sortedPrices[0].date === latestExchangeSessionDate) {
        currentPrice = sortedPrices[0].price;
        if (sortedPrices.length >= 2) {
          prevPrice = sortedPrices[1].price;
          change = currentPrice - prevPrice;
          changePct = prevPrice > 0 ? (change / prevPrice) * 100 : 0;
        }
      }

      return {
        security: sec,
        currentPrice,
        prevPrice,
        change,
        changePct,
      };
    }).filter(mover => mover.currentPrice > 0);
  }, [securities, prices, latestDateByExchange]);

  // Filter movers by exchange
  const filteredMovers = useMemo(() => {
    if (selectedExchange === 'ALL') {
      return allMovers;
    }
    return allMovers.filter(m => m.security.exchangeId === selectedExchange);
  }, [allMovers, selectedExchange]);

  // Sort and slice top 5 gainers and losers
  const marketGainers = useMemo(() => {
    return [...filteredMovers]
      .filter(m => m.changePct > 0)
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 5);
  }, [filteredMovers]);

  const marketLosers = useMemo(() => {
    return [...filteredMovers]
      .filter(m => m.changePct < 0)
      .sort((a, b) => a.changePct - b.changePct)
      .slice(0, 5);
  }, [filteredMovers]);

  // Dynamic news feed from latest equity notes
  const latestNews = useMemo(() => {
    return [...equityNotes]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [equityNotes]);

  return (
    <div className="space-y-4 pb-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Markets</h2>
        <p className="text-xs text-slate-500">Live indices, daily price changes, and corporate synopses across Caribbean exchanges.</p>
      </div>

      {/* Market Indices Panel */}
      <div className="grid grid-cols-2 gap-3">
        {/* GASCI Card */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 text-slate-800/10 font-extrabold text-5xl pointer-events-none select-none">🇬🇾</div>
          <CardContent className="p-4 flex flex-col justify-between h-24 relative z-10">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span className="flex items-center"><TrendingUp className="w-3.5 h-3.5 mr-1 text-emerald-400" /> GASCI Index</span>
              <span>GYD</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black tracking-tight">{indices.GASCI.value.toFixed(1)}</span>
              <span className={`text-xs font-semibold flex items-center px-1.5 py-0.5 rounded ${indices.GASCI.change >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                {indices.GASCI.change >= 0 ? '+' : ''}{indices.GASCI.changePct.toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>
        
        {/* BSE Card */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 text-slate-800/10 font-extrabold text-5xl pointer-events-none select-none">🇧🇧</div>
          <CardContent className="p-4 flex flex-col justify-between h-24 relative z-10">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span className="flex items-center"><TrendingUp className="w-3.5 h-3.5 mr-1 text-yellow-400" /> BSE Index</span>
              <span>BBD</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black tracking-tight">{indices.BSE.value.toFixed(1)}</span>
              <span className={`text-xs font-semibold flex items-center px-1.5 py-0.5 rounded ${indices.BSE.change >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                {indices.BSE.change >= 0 ? '+' : ''}{indices.BSE.changePct.toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* JSE Card */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 text-slate-800/10 font-extrabold text-5xl pointer-events-none select-none">🇯🇲</div>
          <CardContent className="p-4 flex flex-col justify-between h-24 relative z-10">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span className="flex items-center"><TrendingUp className="w-3.5 h-3.5 mr-1 text-green-400" /> JSE Index</span>
              <span>JMD</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black tracking-tight">
                {indices.JSE.value > 0 ? indices.JSE.value.toFixed(1) : '1,000.0'}
              </span>
              <span className={`text-xs font-semibold flex items-center px-1.5 py-0.5 rounded ${indices.JSE.change >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                {indices.JSE.change >= 0 ? '+' : ''}{indices.JSE.changePct.toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* TTSE Card */}
        <Card className="bg-slate-900 border-slate-800 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 text-slate-800/10 font-extrabold text-5xl pointer-events-none select-none">🇹🇹</div>
          <CardContent className="p-4 flex flex-col justify-between h-24 relative z-10">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span className="flex items-center"><TrendingUp className="w-3.5 h-3.5 mr-1 text-cyan-400" /> TTSE Index</span>
              <span>TTD</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black tracking-tight">
                {indices.TTSE.value > 0 ? indices.TTSE.value.toFixed(1) : '1,000.0'}
              </span>
              <span className={`text-xs font-semibold flex items-center px-1.5 py-0.5 rounded ${indices.TTSE.change >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                {indices.TTSE.change >= 0 ? '+' : ''}{indices.TTSE.changePct.toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Relevant News Feed */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center space-x-2 mb-4 border-b border-slate-100 pb-2">
            <Newspaper className="w-5 h-5 text-blue-600 animate-pulse" />
            <div className="font-bold text-sm uppercase tracking-wide text-slate-800">Relevant Corporate News</div>
          </div>
          
          <div className="space-y-4 divide-y divide-slate-100">
            {latestNews.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center text-slate-400">
                <HelpCircle className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm">No recent investment notes logged.</p>
                <p className="text-xs text-slate-400 max-w-[280px] mt-1">Add research journal synopses on security pages to populate the feed.</p>
              </div>
            ) : (
              latestNews.map((news, index) => {
                const sec = securities.find(s => s.id === news.securityId);
                return (
                  <Link 
                    to={`/holdings/${news.securityId}`}
                    key={news.id}
                    className={`block hover:bg-slate-50 p-3 rounded-xl transition-colors ${index > 0 ? 'pt-4' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-900 text-sm">{sec?.ticker || 'Security'}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-semibold">{news.date}</span>
                      </div>
                      <Badge variant={sec?.exchangeId === 'GASCI' ? 'blue' : 'yellow'}>{sec?.exchangeId}</Badge>
                    </div>
                    <div className="font-bold text-slate-800 text-xs mb-1.5 leading-snug">{news.title}</div>
                    <div className="text-slate-500 text-xs line-clamp-3 leading-relaxed">{news.synopsis}</div>
                  </Link>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Market Overview & Biggest Movers */}
      <Card>
        <CardContent className="p-5">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 flex-wrap gap-3">
            <div>
              <div className="font-bold text-sm uppercase tracking-wide text-slate-800">Movers for the Markets</div>
              <div className="text-xs text-slate-400 mt-0.5">Top gainers and losers by percentage price change.</div>
            </div>
            
            {/* Filter Swaps */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              {(['ALL', 'GASCI', 'BSE', 'JSE', 'TTSE'] as const).map(ex => (
                <button
                  key={ex}
                  onClick={() => setSelectedExchange(ex)}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    selectedExchange === ex
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/40'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {ex === 'ALL' ? 'All' : ex}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Top Gainers Column */}
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3.5 flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shadow-sm animate-pulse" />
                Top Gainers
              </div>
              <div className="space-y-2">
                {marketGainers.length === 0 ? (
                  <div className="text-slate-400 text-xs py-4 text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/50">No price updates found.</div>
                ) : (
                  marketGainers.map(mover => {
                    const isWatched = watchlist.includes(mover.security.id);
                    const currency = getSecurityCurrency(mover.security);
                    return (
                      <Link 
                        to={`/holdings/${mover.security.id}`} 
                        key={mover.security.id} 
                        className="flex justify-between items-center bg-slate-50/60 hover:bg-slate-100/80 p-3.5 rounded-xl border border-slate-100/50 transition-all block cursor-pointer"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {/* Watchlist Toggle */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleWatchlist(mover.security.id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors shrink-0 cursor-pointer"
                          >
                            <Star className={`w-4 h-4 ${isWatched ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                          </button>
                          
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-extrabold text-slate-900 text-sm tracking-tight">{mover.security.ticker}</span>
                              <Badge variant={mover.security.exchangeId === 'GASCI' ? 'blue' : 'yellow'}>
                                {mover.security.exchangeId}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[130px] sm:max-w-[200px] mt-0.5">
                              {mover.security.companyName}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-3">
                          <div>
                            <div className="font-extrabold text-sm text-slate-900 tracking-tight">
                              {formatMoney(mover.currentPrice, currency)}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Last Price</div>
                          </div>
                          <span className="px-2.5 py-1 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg flex items-center gap-0.5 shrink-0">
                            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            {mover.changePct >= 0 ? '+' : ''}{formatPercentage(mover.changePct)}
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* Top Losers Column */}
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3.5 flex items-center">
                <span className="w-2 h-2 rounded-full bg-rose-500 mr-2 shadow-sm animate-pulse" />
                Top Losers
              </div>
              <div className="space-y-2">
                {marketLosers.length === 0 ? (
                  <div className="text-slate-400 text-xs py-4 text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/50">No price updates found.</div>
                ) : (
                  marketLosers.map(mover => {
                    const isWatched = watchlist.includes(mover.security.id);
                    const currency = getSecurityCurrency(mover.security);
                    return (
                      <Link 
                        to={`/holdings/${mover.security.id}`} 
                        key={mover.security.id} 
                        className="flex justify-between items-center bg-slate-50/60 hover:bg-slate-100/80 p-3.5 rounded-xl border border-slate-100/50 transition-all block cursor-pointer"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {/* Watchlist Star */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleWatchlist(mover.security.id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors shrink-0 cursor-pointer"
                          >
                            <Star className={`w-4 h-4 ${isWatched ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                          </button>
                          
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-extrabold text-slate-900 text-sm tracking-tight">{mover.security.ticker}</span>
                              <Badge variant={mover.security.exchangeId === 'GASCI' ? 'blue' : 'yellow'}>
                                {mover.security.exchangeId}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-450 truncate max-w-[130px] mt-0.5">
                              {mover.security.companyName}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-3">
                          <div>
                            <div className="font-extrabold text-sm text-slate-900 tracking-tight">
                              {formatMoney(mover.currentPrice, currency)}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Last Price</div>
                          </div>
                          <span className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg flex items-center gap-0.5 shrink-0">
                            <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            {formatPercentage(mover.changePct)}
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
