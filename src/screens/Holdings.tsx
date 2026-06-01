import { useState } from 'react';
import { useStore } from '../store';
import { Card, CardContent, Badge } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { Link } from 'react-router-dom';
import { Search, Filter, AlertTriangle, Eye } from 'lucide-react';

export const Holdings = () => {
  const { holdings, securities, watchlist, prices } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'PORTFOLIO' | 'WATCHLIST'>('PORTFOLIO');

  const filteredHoldings = holdings.filter(h => 
    h.security.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    h.security.ticker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const watchlistedSecurities = securities.filter(s => 
    watchlist.includes(s.id) && 
    (s.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.ticker.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200 rounded-lg mb-4">
        <button 
          className={`py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'PORTFOLIO' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          onClick={() => setActiveTab('PORTFOLIO')}
        >
          Portfolio
        </button>
        <button 
          className={`py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center space-x-1 ${activeTab === 'WATCHLIST' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          onClick={() => setActiveTab('WATCHLIST')}
        >
          <Eye className="w-4 h-4 mr-1" />
          Watchlist
        </button>
      </div>

      <div className="flex items-center space-x-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
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
        {activeTab === 'PORTFOLIO' ? (
          filteredHoldings.map((h) => {
            const isStale = h.priceStaleStatus === 'STALE' || h.priceStaleStatus === 'VERY_STALE';
            const isGreen = h.unrealizedGainLossPctUSD >= 0;
            
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
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{formatMoney(h.marketValueUSD, 'USD')}</div>
                        <div className="text-xs text-slate-500">{formatMoney(h.marketValueLocal, h.security.currency)}</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-4">
                      <div className="flex space-x-2">
                        <Badge variant="gray">{h.security.country}</Badge>
                        <Badge variant="gray">{h.portfolioWeight.toFixed(1)}%</Badge>
                      </div>
                      <div className="text-right">
                        <span className={isGreen ? 'text-emerald-600 font-medium text-sm' : 'text-rose-600 font-medium text-sm'}>
                          {isGreen ? '+' : ''}{formatPercentage(h.unrealizedGainLossPctUSD)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        ) : (
          watchlistedSecurities.map((s) => {
            const secPrices = prices.filter(p => p.securityId === s.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const lastPrice = secPrices.length > 0 ? secPrices[0].price : 0;
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
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{formatMoney(lastPrice, s.currency)}</div>
                        <div className="text-xs text-slate-500">{s.currency}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-end mt-4">
                      <div className="flex space-x-2">
                        <Badge variant="gray">{s.country}</Badge>
                        <Badge variant="gray">{s.sector}</Badge>
                      </div>
                      {s.fundamentals?.peRatio && (
                         <div className="text-xs font-medium text-slate-600">P/E: {s.fundamentals.peRatio.toFixed(1)}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
        
        {activeTab === 'PORTFOLIO' && filteredHoldings.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            No holdings found.
          </div>
        )}
        
        {activeTab === 'WATCHLIST' && watchlistedSecurities.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            Watchlist is empty.
          </div>
        )}
      </div>
    </div>
  );
};
