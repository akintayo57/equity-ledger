import { useStore } from '../store';
import { Card, CardContent, Badge } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { AlertCircle, ArrowUpRight, ArrowDownRight, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

export const Dashboard = () => {
  const { 
    holdings, 
    portfolioSummary, 
    securities, 
    prices, 
    watchlist, 
    toggleWatchlist 
  } = useStore();

  const [selectedExchange, setSelectedExchange] = useState<'ALL' | 'GASCI' | 'BSE'>('ALL');

  const isGreen = portfolioSummary.unrealizedGainUSD >= 0;

  const stalePriceWarnings = holdings.filter(h => h.priceStaleStatus === 'STALE' || h.priceStaleStatus === 'VERY_STALE');
  const staleFXWarnings = holdings.filter(h => h.fxStaleStatus === 'STALE');
  const hasUncertainty = holdings.some(h => h.hasUncertainty);

  const topGainers = useMemo(() => {
    return [...holdings].sort((a, b) => b.unrealizedGainLossPctUSD - a.unrealizedGainLossPctUSD).slice(0, 3);
  }, [holdings]);

  const topLosers = useMemo(() => {
    return [...holdings].sort((a, b) => a.unrealizedGainLossPctUSD - b.unrealizedGainLossPctUSD).slice(0, 3);
  }, [holdings]);

  // Allocation by country
  const allocation = useMemo(() => {
    const acc = new Map<string, number>();
    holdings.forEach(h => {
      acc.set(h.security.country, (acc.get(h.security.country) || 0) + h.marketValueUSD);
    });
    return Array.from(acc.entries()).map(([country, val]) => ({
      country,
      pct: portfolioSummary.totalMarketValueUSD > 0 ? (val / portfolioSummary.totalMarketValueUSD) * 100 : 0
    })).sort((a, b) => b.pct - a.pct);
  }, [holdings, portfolioSummary.totalMarketValueUSD]);

  // Market Movers calculations for all listed stocks
  const allMovers = useMemo(() => {
    // 1. Group prices by security ID
    const pricesBySec = new Map<string, typeof prices>();
    prices.forEach(p => {
      if (!pricesBySec.has(p.securityId)) {
        pricesBySec.set(p.securityId, []);
      }
      pricesBySec.get(p.securityId)!.push(p);
    });

    // 2. Compute change for each security
    return securities.map(sec => {
      const secPrices = pricesBySec.get(sec.id) || [];
      const sortedPrices = [...secPrices].sort((a, b) => b.date.localeCompare(a.date));

      let currentPrice = 0;
      let prevPrice = 0;
      let change = 0;
      let changePct = 0;

      if (sortedPrices.length >= 2) {
        currentPrice = sortedPrices[0].price;
        prevPrice = sortedPrices[1].price;
        change = currentPrice - prevPrice;
        changePct = prevPrice > 0 ? (change / prevPrice) * 100 : 0;
      } else if (sortedPrices.length === 1) {
        currentPrice = sortedPrices[0].price;
      }

      return {
        security: sec,
        currentPrice,
        prevPrice,
        change,
        changePct,
      };
    }).filter(mover => mover.currentPrice > 0);
  }, [securities, prices]);

  // Filter movers by exchange
  const filteredMovers = useMemo(() => {
    if (selectedExchange === 'ALL') {
      return allMovers;
    }
    return allMovers.filter(m => m.security.exchange === selectedExchange);
  }, [allMovers, selectedExchange]);

  // Sort and slice top 4 gainers and losers
  const marketGainers = useMemo(() => {
    return [...filteredMovers]
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, 4);
  }, [filteredMovers]);

  const marketLosers = useMemo(() => {
    return [...filteredMovers]
      .sort((a, b) => a.changePct - b.changePct)
      .slice(0, 4);
  }, [filteredMovers]);

  return (
    <div className="space-y-4">
      {/* Main Portfolio Summary */}
      <Card className="bg-slate-900 text-white border-slate-800">
        <CardContent className="p-6">
          <div className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2">Total Value (USD)</div>
          <div className="text-4xl font-bold mb-4">{formatMoney(portfolioSummary.totalMarketValueUSD, 'USD')}</div>
          
          <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
            <div>
              <div className="text-xs text-slate-400 mb-1">Unrealized Gain</div>
              <div className="flex items-center space-x-1">
                {isGreen ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-rose-400" />}
                <span className={isGreen ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                  {formatMoney(portfolioSummary.unrealizedGainUSD, 'USD')}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Capital Growth</div>
              <div className="flex items-center space-x-1">
                <span className={isGreen ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                  {formatPercentage(portfolioSummary.capitalGrowthPct)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Total Cost Basis: {formatMoney(portfolioSummary.totalCostBasisUSD, 'USD')}
            {hasUncertainty && <span className="ml-1 text-amber-500 font-medium">* (Includes estimated cost basis)</span>}
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {(stalePriceWarnings.length > 0 || staleFXWarnings.length > 0 || hasUncertainty) && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="flex items-start space-x-3 p-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <strong className="block mb-1">Portfolio & Data Quality Warnings</strong>
              {hasUncertainty && <div>• Some holdings contain transactions with estimated cost basis (e.g. inherited or predate exchange).</div>}
              {stalePriceWarnings.length > 0 && <div>• {stalePriceWarnings.length} holding(s) with stale prices.</div>}
              {staleFXWarnings.length > 0 && <div>• {staleFXWarnings.length} holding(s) with stale FX rates.</div>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Largest Holdings */}
      <Card>
        <CardContent>
          <div className="font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Largest Holdings</div>
          <div className="space-y-3">
            {holdings.slice(0, 3).map(h => (
              <Link 
                to={`/holdings/${h.security.id}`} 
                key={h.security.id} 
                className="flex justify-between items-center hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors block cursor-pointer"
              >
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{h.security.ticker}</div>
                  <div className="text-[11px] text-slate-400">{h.security.exchange} • {h.security.country}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-slate-900">{formatPercentage(h.portfolioWeight)}</div>
                  <div className="text-[11px] text-slate-400">{formatMoney(h.marketValueUSD, 'USD')}</div>
                </div>
              </Link>
            ))}
            {holdings.length === 0 && (
              <div className="text-slate-400 text-sm py-2">No active holdings in portfolio. Add transactions to see stats.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Allocation */}
      {holdings.length > 0 && (
        <Card>
          <CardContent>
            <div className="font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Allocation by Country</div>
            <div className="space-y-3">
              {allocation.map(a => (
                <div key={a.country}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{a.country}</span>
                    <span className="font-medium">{formatPercentage(a.pct)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full" style={{ width: `${a.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Top Gainers & Losers (Portfolio) */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Top Portfolio Gainers</div>
              <div className="space-y-2">
                {topGainers.filter(g => g.unrealizedGainLossPctUSD > 0).map(g => (
                  <Link 
                    to={`/holdings/${g.security.id}`} 
                    key={g.security.id} 
                    className="flex justify-between items-center hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors block cursor-pointer"
                  >
                    <span className="font-semibold text-slate-900 text-sm">{g.security.ticker}</span>
                    <span className="text-emerald-600 text-sm font-bold">+{formatPercentage(g.unrealizedGainLossPctUSD)}</span>
                  </Link>
                ))}
                {topGainers.filter(g => g.unrealizedGainLossPctUSD > 0).length === 0 && (
                  <div className="text-slate-400 text-xs py-1">No positive gainers.</div>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Top Portfolio Losers</div>
              <div className="space-y-2">
                {topLosers.filter(l => l.unrealizedGainLossPctUSD < 0).map(l => (
                  <Link 
                    to={`/holdings/${l.security.id}`} 
                    key={l.security.id} 
                    className="flex justify-between items-center hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors block cursor-pointer"
                  >
                    <span className="font-semibold text-slate-900 text-sm">{l.security.ticker}</span>
                    <span className="text-rose-600 text-sm font-bold">{formatPercentage(l.unrealizedGainLossPctUSD)}</span>
                  </Link>
                ))}
                {topLosers.filter(l => l.unrealizedGainLossPctUSD < 0).length === 0 && (
                  <div className="text-slate-400 text-xs py-1">No negative losers.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Market Overview & Biggest Movers */}
      <Card>
        <CardContent className="p-5">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 flex-wrap gap-3">
            <div>
              <div className="font-semibold text-base text-slate-800">Market Overview</div>
              <div className="text-xs text-slate-400 mt-0.5">Biggest price movers across all regional listed stocks</div>
            </div>
            
            {/* Tabs for Filtering */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setSelectedExchange('ALL')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  selectedExchange === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All Exchanges
              </button>
              <button
                onClick={() => setSelectedExchange('GASCI')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  selectedExchange === 'GASCI'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                🇬🇾 GASCI
              </button>
              <button
                onClick={() => setSelectedExchange('BSE')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  selectedExchange === 'BSE'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                🇧🇧 BSE
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Gainers Column */}
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2" />
                Top Gainers
              </div>
              <div className="space-y-3">
                {marketGainers.length === 0 ? (
                  <div className="text-slate-400 text-xs py-4">No price data available.</div>
                ) : (
                  marketGainers.map(mover => {
                    const isWatched = watchlist.includes(mover.security.id);
                    return (
                      <Link 
                        to={`/holdings/${mover.security.id}`} 
                        key={mover.security.id} 
                        className="flex justify-between items-center bg-slate-50/70 hover:bg-slate-100/70 p-3 rounded-xl transition-all block cursor-pointer"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {/* Watchlist Toggle */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleWatchlist(mover.security.id);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-200/50 transition-colors shrink-0 cursor-pointer"
                            title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                          >
                            <Star className={`w-3.5 h-3.5 ${isWatched ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                          </button>
                          
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-900 text-sm">{mover.security.ticker}</span>
                              <Badge variant={mover.security.exchange === 'GASCI' ? 'blue' : 'yellow'}>
                                {mover.security.exchange}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[130px] sm:max-w-[200px]">
                              {mover.security.companyName}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-bold text-sm text-slate-900">
                            {formatMoney(mover.currentPrice, mover.security.currency)}
                          </div>
                          <div className={`text-xs font-semibold ${mover.changePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {mover.changePct >= 0 ? '+' : ''}{formatPercentage(mover.changePct)}
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* Top Losers Column */}
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-2" />
                Top Losers
              </div>
              <div className="space-y-3">
                {marketLosers.length === 0 ? (
                  <div className="text-slate-400 text-xs py-4">No price data available.</div>
                ) : (
                  marketLosers.map(mover => {
                    const isWatched = watchlist.includes(mover.security.id);
                    return (
                      <Link 
                        to={`/holdings/${mover.security.id}`} 
                        key={mover.security.id} 
                        className="flex justify-between items-center bg-slate-50/70 hover:bg-slate-100/70 p-3 rounded-xl transition-all block cursor-pointer"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {/* Watchlist Toggle */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleWatchlist(mover.security.id);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-200/50 transition-colors shrink-0 cursor-pointer"
                            title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                          >
                            <Star className={`w-3.5 h-3.5 ${isWatched ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                          </button>
                          
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-900 text-sm">{mover.security.ticker}</span>
                              <Badge variant={mover.security.exchange === 'GASCI' ? 'blue' : 'yellow'}>
                                {mover.security.exchange}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[130px] sm:max-w-[200px]">
                              {mover.security.companyName}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-bold text-sm text-slate-900">
                            {formatMoney(mover.currentPrice, mover.security.currency)}
                          </div>
                          <div className={`text-xs font-semibold ${mover.changePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {mover.changePct >= 0 ? '+' : ''}{formatPercentage(mover.changePct)}
                          </div>
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


