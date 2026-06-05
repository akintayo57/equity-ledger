import { useStore } from '../store';
import { Card, CardContent } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { AlertCircle, ArrowUpRight, ArrowDownRight, Award } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

export const Dashboard = () => {
  const { 
    holdings, 
    portfolioSummary 
  } = useStore();

  const isGreen = portfolioSummary.unrealizedGainUSD >= 0;

  const { stalePriceWarnings, staleFXWarnings, hasUncertainty } = useMemo(() => {
    return {
      stalePriceWarnings: holdings.filter(h => h.priceStaleStatus === 'STALE' || h.priceStaleStatus === 'VERY_STALE'),
      staleFXWarnings: holdings.filter(h => h.fxStaleStatus === 'STALE'),
      hasUncertainty: holdings.some(h => h.hasUncertainty)
    };
  }, [holdings]);

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
      acc.set(h.country, (acc.get(h.country) || 0) + h.marketValueUSD);
    });
    return Array.from(acc.entries()).map(([country, val]) => ({
      country,
      pct: portfolioSummary.totalMarketValueUSD > 0 ? (val / portfolioSummary.totalMarketValueUSD) * 100 : 0
    })).sort((a, b) => b.pct - a.pct);
  }, [holdings, portfolioSummary.totalMarketValueUSD]);

  return (
    <div className="space-y-4 pb-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Portfolio Dashboard</h2>
        <p className="text-xs text-slate-500">Real-time asset valuation, growth rates, and geographical allocation of your holdings.</p>
      </div>

      {/* Main Portfolio Summary Card */}
      <Card className="bg-slate-900 text-white border-slate-800 relative overflow-hidden group shadow-lg">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <CardContent className="p-6 relative z-10">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Value (USD)</div>
          <div className="text-4xl font-black tracking-tight mb-5">{formatMoney(portfolioSummary.totalMarketValueUSD, 'USD')}</div>
          
          <div className="grid grid-cols-3 gap-3 border-t border-slate-850 pt-4">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Unrealized Gain</div>
              <div className="flex items-center space-x-0.5">
                {isGreen ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-rose-450 shrink-0" />
                )}
                <span className={isGreen ? 'text-emerald-450 text-sm font-bold tracking-tight' : 'text-rose-455 text-sm font-bold tracking-tight'}>
                  {formatMoney(portfolioSummary.unrealizedGainUSD, 'USD')}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Dividends</div>
              <div className="flex items-center space-x-1">
                <Award className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-blue-450 text-sm font-bold tracking-tight">
                  {formatMoney(portfolioSummary.totalDividendsUSD, 'USD')}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Growth</div>
              <div className="flex items-center">
                <span className={isGreen ? 'text-emerald-400 text-sm font-bold tracking-tight' : 'text-rose-450 text-sm font-bold tracking-tight'}>
                  {formatPercentage(portfolioSummary.capitalGrowthPct)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-slate-500 flex justify-between items-center">
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
          <div className="font-bold text-xs uppercase tracking-widest text-slate-850 mb-4 border-b border-slate-100 pb-2">Holdings</div>
          <div className="space-y-3">
            {holdings.map(h => (
              <Link 
                to={`/holdings/${h.security.id}`} 
                key={h.security.id} 
                className="flex justify-between items-center hover:bg-slate-50/80 p-2.5 -mx-2.5 rounded-xl transition-all block cursor-pointer"
              >
                <div>
                  <div className="font-extrabold text-slate-900 text-sm tracking-tight">{h.security.ticker}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{h.exchangeName} • {h.country}</div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-sm text-slate-900 tracking-tight">{formatPercentage(h.portfolioWeight)}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{formatMoney(h.marketValueUSD, 'USD')}</div>
                </div>
              </Link>
            ))}
            {holdings.length === 0 && (
              <div className="text-slate-400 text-xs py-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                No active holdings in portfolio. Log purchases under the Transactions tab to construct your ledger.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Allocation */}
      {holdings.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="font-bold text-xs uppercase tracking-widest text-slate-850 mb-4 border-b border-slate-100 pb-2">Allocation by Country</div>
            <div className="space-y-4">
              {allocation.map(a => (
                <div key={a.country}>
                  <div className="flex justify-between text-xs font-semibold mb-1.5 text-slate-700">
                    <span>{a.country}</span>
                    <span className="font-bold text-slate-950">{formatPercentage(a.pct)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: `${a.pct}%` }} />
                  </div>
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
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Top Gainers</div>
              <div className="space-y-2">
                {topGainers.filter(g => g.unrealizedGainLossPctUSD > 0).map(g => (
                  <Link 
                    to={`/holdings/${g.security.id}`} 
                    key={g.security.id} 
                    className="flex justify-between items-center hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors block cursor-pointer"
                  >
                    <span className="font-bold text-slate-900 text-xs tracking-tight">{g.security.ticker}</span>
                    <span className="text-emerald-600 text-xs font-black">+{formatPercentage(g.unrealizedGainLossPctUSD)}</span>
                  </Link>
                ))}
                {topGainers.filter(g => g.unrealizedGainLossPctUSD > 0).length === 0 && (
                  <div className="text-slate-400 text-[10px] py-1">No positive gainers yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Top Losers</div>
              <div className="space-y-2">
                {topLosers.filter(l => l.unrealizedGainLossPctUSD < 0).map(l => (
                  <Link 
                    to={`/holdings/${l.security.id}`} 
                    key={l.security.id} 
                    className="flex justify-between items-center hover:bg-slate-50 p-2 -mx-2 rounded-lg transition-colors block cursor-pointer"
                  >
                    <span className="font-bold text-slate-900 text-xs tracking-tight">{l.security.ticker}</span>
                    <span className="text-rose-650 text-xs font-black">{formatPercentage(l.unrealizedGainLossPctUSD)}</span>
                  </Link>
                ))}
                {topLosers.filter(l => l.unrealizedGainLossPctUSD < 0).length === 0 && (
                  <div className="text-slate-400 text-[10px] py-1">No negative losers.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
