import { useStore } from '../store';
import { Card, CardContent, StatBox, Badge } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useMemo } from 'react';

export const Dashboard = () => {
  const { holdings, portfolioSummary } = useStore();

  const isGreen = portfolioSummary.unrealizedGainUSD >= 0;

  const stalePriceWarnings = holdings.filter(h => h.priceStaleStatus === 'STALE' || h.priceStaleStatus === 'VERY_STALE');
  const staleFXWarnings = holdings.filter(h => h.fxStaleStatus === 'STALE');

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
      pct: (val / portfolioSummary.totalMarketValueUSD) * 100
    })).sort((a, b) => b.pct - a.pct);
  }, [holdings, portfolioSummary.totalMarketValueUSD]);

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
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {(stalePriceWarnings.length > 0 || staleFXWarnings.length > 0) && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="flex items-start space-x-3 p-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <strong className="block mb-1">Data Quality Warnings</strong>
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
          <div className="space-y-4">
            {holdings.slice(0, 3).map(h => (
              <div key={h.security.id} className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-slate-900">{h.security.ticker}</div>
                  <div className="text-xs text-slate-500">{h.security.exchange} • {h.security.country}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatPercentage(h.portfolioWeight)}</div>
                  <div className="text-xs text-slate-500">{formatMoney(h.marketValueUSD, 'USD')}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Allocation */}
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
      
      {/* Top Gainers & Losers */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Top Gainers</div>
            <div className="space-y-3">
              {topGainers.filter(g => g.unrealizedGainLossPctUSD > 0).map(g => (
                <div key={g.security.id} className="flex justify-between items-center">
                  <span className="font-medium text-sm">{g.security.ticker}</span>
                  <span className="text-emerald-600 text-sm font-medium">+{formatPercentage(g.unrealizedGainLossPctUSD)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Top Losers</div>
            <div className="space-y-3">
              {topLosers.filter(l => l.unrealizedGainLossPctUSD < 0).map(l => (
                <div key={l.security.id} className="flex justify-between items-center">
                  <span className="font-medium text-sm">{l.security.ticker}</span>
                  <span className="text-rose-600 text-sm font-medium">{formatPercentage(l.unrealizedGainLossPctUSD)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};
