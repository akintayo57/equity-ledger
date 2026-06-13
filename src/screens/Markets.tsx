import { useStore } from '../store';
import { Card, CardContent, Badge } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { Star, TrendingUp, Newspaper, HelpCircle, ArrowUpRight, ArrowDownRight, Search, X, ArrowLeft, Info, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export const Markets = () => {
  const { 
    securities, 
    prices, 
    exchanges,
    equityNotes,
    watchlist, 
    toggleWatchlist,
    indices,
    indexHistory,
    theme
  } = useStore();

  const [selectedExchange, setSelectedExchange] = useState<'ALL' | 'GASCI' | 'BSE' | 'JSE' | 'TTSE' | 'ECSE'>('ALL');

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSecurity, setSelectedSecurity] = useState<any | null>(null);
  const [selectedIndexId, setSelectedIndexId] = useState<'GASCI' | 'BSE' | 'JSE' | 'TTSE' | 'ECSE' | null>(null);
  const [isCompositionExpanded, setIsCompositionExpanded] = useState(false);
  const [chartRange, setChartRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('6M');

  // Search query filter
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return securities.filter(s => {
      const companyName = s.companyName || '';
      const ticker = s.ticker || '';
      const exchangeId = s.exchangeId || '';
      return (
        companyName.toLowerCase().includes(query) ||
        ticker.toLowerCase().includes(query) ||
        exchangeId.toLowerCase().includes(query)
      );
    });
  }, [securities, searchQuery]);

  // Selected security stats
  const selectedExInfo = useMemo(() => {
    if (!selectedSecurity) return null;
    const ex = exchanges.find(e => e.id === selectedSecurity.exchangeId);
    return {
      country: ex ? ex.country : 'Unknown',
      currency: selectedSecurity.currency || (ex ? ex.currency : 'USD'),
      exchangeName: ex ? ex.name : (selectedSecurity.exchangeId || 'Unknown')
    };
  }, [selectedSecurity, exchanges]);

  const selectedNotes = useMemo(() => {
    if (!selectedSecurity) return [];
    return equityNotes
      .filter(n => n.securityId === selectedSecurity.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [equityNotes, selectedSecurity]);

  const selectedLatestNote = selectedNotes.length > 0 ? selectedNotes[0] : null;

  const selectedFundamentals = useMemo(() => {
    if (!selectedSecurity) return null;
    if (selectedLatestNote) {
      return {
        peRatio: selectedLatestNote.peRatio,
        eps: selectedLatestNote.eps,
        dividendYield: selectedLatestNote.dividendYield,
        pbRatio: selectedLatestNote.pbRatio,
        roe: selectedLatestNote.roe,
        lastUpdated: selectedLatestNote.date
      };
    }
    return selectedSecurity.fundamentals;
  }, [selectedSecurity, selectedLatestNote]);

  const selectedSecPrices = useMemo(() => {
    if (!selectedSecurity) return [];
    return prices
      .filter(p => p.securityId === selectedSecurity.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [prices, selectedSecurity]);

  const selectedLastPrice = selectedSecPrices.length > 0 ? selectedSecPrices[0].price : 0;

  const selectedChangePct = useMemo(() => {
    if (selectedSecPrices.length >= 2) {
      const current = selectedSecPrices[0].price;
      const prev = selectedSecPrices[1].price;
      const diff = current - prev;
      return prev > 0 ? (diff / prev) * 100 : 0;
    }
    return 0;
  }, [selectedSecPrices]);

  const selectedPriceHistory = useMemo(() => {
    if (!selectedSecurity) return [];
    let daysToLookBack = 180;
    let getLabel = (d: Date) => format(d, 'MMM dd');

    let startDate: Date | null = null;
    if (chartRange === '1M') { daysToLookBack = 30; getLabel = (d: Date) => format(d, 'dd MMM'); }
    else if (chartRange === '3M') { daysToLookBack = 90; getLabel = (d: Date) => format(d, 'dd MMM'); }
    else if (chartRange === '6M') { daysToLookBack = 180; getLabel = (d: Date) => format(d, 'MMM yy'); }
    else if (chartRange === '1Y') { daysToLookBack = 365; getLabel = (d: Date) => format(d, 'MMM yy'); }
    else if (chartRange === 'ALL') { daysToLookBack = Infinity; getLabel = (d: Date) => format(d, 'MMM yy'); }

    if (daysToLookBack !== Infinity) {
      startDate = new Date(Date.now() - daysToLookBack * 86400000);
    }
    
    const filteredRealData = selectedSecPrices
      .filter(p => !startDate || new Date(p.date) >= startDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (filteredRealData.length > 0) {
      const data = filteredRealData.map(p => ({
        date: getLabel(new Date(p.date)),
        price: p.price
      }));

      if (data.length === 1) {
        const fallbackDate = startDate || new Date(Date.now() - 30 * 86400000);
        return [
          { date: getLabel(fallbackDate), price: data[0].price },
          data[0]
        ];
      }
      return data;
    }

    const fallbackPrice = selectedLastPrice || 0;
    const fallbackDate = startDate || new Date(Date.now() - 30 * 86400000);
    return [
      { date: getLabel(fallbackDate), price: fallbackPrice },
      { date: getLabel(new Date()), price: fallbackPrice }
    ];
  }, [selectedSecPrices, selectedLastPrice, chartRange, selectedSecurity]);

  // Helper to resolve security currency
  const getSecurityCurrency = (sec: any) => {
    if (sec.currency) return sec.currency;
    const ex = exchanges.find(e => e.id === sec.exchangeId);
    return ex ? ex.currency : 'USD';
  };

  // Derived summary from stored indexHistory for all indices
  const indicesSummary = useMemo(() => {
    const summary: Record<string, { value: number; change: number; changePct: number }> = {};
    indices.forEach(idx => {
      const hist = indexHistory
        .filter(h => h.indexId === idx.id)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (hist.length >= 1) {
        const current = hist[hist.length - 1].value;
        const prev = hist.length >= 2 ? hist[hist.length - 2].value : current;
        const change = current - prev;
        const changePct = prev > 0 ? (change / prev) * 100 : 0;
        summary[idx.id] = { value: current, change, changePct };
      } else {
        summary[idx.id] = { value: 0, change: 0, changePct: 0 };
      }
    });
    return summary;
  }, [indices, indexHistory]);


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

  // Find the global latest price date across all exchanges
  const globalLatestDate = useMemo(() => {
    const dates = Object.values(latestDateByExchange);
    if (dates.length === 0) return null;
    return dates.reduce((latest, current) => current > latest ? current : latest, dates[0]);
  }, [latestDateByExchange]);

  // Stored Index History for selected exchange
  const selectedIndexHistory = useMemo(() => {
    if (!selectedIndexId) return [];

    let daysToLookBack = 180;
    let getLabel = (d: Date) => format(d, 'MMM dd');

    let startDateStr = '';
    if (chartRange === '1M') { daysToLookBack = 30; getLabel = (d: Date) => format(d, 'dd MMM'); }
    else if (chartRange === '3M') { daysToLookBack = 90; getLabel = (d: Date) => format(d, 'dd MMM'); }
    else if (chartRange === '6M') { daysToLookBack = 180; getLabel = (d: Date) => format(d, 'MMM yy'); }
    else if (chartRange === '1Y') { daysToLookBack = 365; getLabel = (d: Date) => format(d, 'MMM yy'); }
    else if (chartRange === 'ALL') { daysToLookBack = Infinity; getLabel = (d: Date) => format(d, 'MMM yy'); }

    if (daysToLookBack !== Infinity) {
      const startDate = new Date(Date.now() - daysToLookBack * 86400000);
      startDateStr = format(startDate, 'yyyy-MM-dd');
    }

    const filtered = indexHistory
      .filter(h => h.indexId === selectedIndexId && (!startDateStr || h.date >= startDateStr))
      .sort((a, b) => a.date.localeCompare(b.date));

    return filtered.map(h => ({
      date: getLabel(new Date(h.date)),
      rawValue: h.value
    }));
  }, [selectedIndexId, indexHistory, chartRange]);

  const selectedIndexMetadata = useMemo(() => {
    if (!selectedIndexId) return null;
    const indexDef = indices.find(idx => idx.id === selectedIndexId);
    if (!indexDef) return null;

    const ex = exchanges.find(e => e.id === indexDef.exchangeId) || {
      name: indexDef.id === 'GASCI' ? 'Guyana Stock Exchange' :
            indexDef.id === 'BSE' ? 'Barbados Stock Exchange' :
            indexDef.id === 'JSE' ? 'Jamaica Stock Exchange' :
            indexDef.id === 'TTSE' ? 'Trinidad & Tobago Stock Exchange' :
            indexDef.id === 'ECSE' ? 'Eastern Caribbean Securities Exchange' : 'Unknown Stock Exchange',
      country: indexDef.id === 'GASCI' ? 'Guyana' :
               indexDef.id === 'BSE' ? 'Barbados' :
               indexDef.id === 'JSE' ? 'Jamaica' :
               indexDef.id === 'TTSE' ? 'Trinidad & Tobago' :
               indexDef.id === 'ECSE' ? 'Eastern Caribbean' : 'Unknown',
      currency: indexDef.id === 'GASCI' ? 'GYD' :
                indexDef.id === 'BSE' ? 'BBD' :
                indexDef.id === 'JSE' ? 'JMD' :
                indexDef.id === 'TTSE' ? 'TTD' :
                indexDef.id === 'ECSE' ? 'XCD' : 'USD'
    };

    const exIndexInfo = indicesSummary[selectedIndexId] || { value: 0, change: 0, changePct: 0 };

    // Find latest pricing date for this exchange in history
    const hist = indexHistory
      .filter(h => h.indexId === selectedIndexId)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latestDate = hist.length > 0 ? hist[hist.length - 1].date : 'N/A';

    return {
      id: selectedIndexId,
      name: ex.name,
      country: ex.country,
      currency: ex.currency,
      value: exIndexInfo.value,
      change: exIndexInfo.change,
      changePct: exIndexInfo.changePct,
      latestDate,
      scale: indexDef.scale
    };
  }, [selectedIndexId, indices, indexHistory, exchanges, indicesSummary]);

  const activeIndexDef = useMemo(() => {
    if (!selectedIndexId) return null;
    return indices.find(idx => idx.id === selectedIndexId);
  }, [selectedIndexId, indices]);

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
      if (!globalLatestDate) return [];
      // Only consider exchanges whose latest session date matches the global latest date
      return allMovers.filter(m => {
        const exId = m.security.exchangeId;
        return exId && latestDateByExchange[exId] === globalLatestDate;
      });
    }
    return allMovers.filter(m => m.security.exchangeId === selectedExchange);
  }, [allMovers, selectedExchange, globalLatestDate, latestDateByExchange]);

  // Map the current active session date based on selection
  const currentSessionDate = useMemo(() => {
    if (selectedExchange === 'ALL') {
      return globalLatestDate;
    }
    return latestDateByExchange[selectedExchange] || null;
  }, [selectedExchange, globalLatestDate, latestDateByExchange]);

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
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Markets</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Live indices, daily price changes, and corporate synopses across Caribbean exchanges.</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search all equities across exchanges..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-slate-900 dark:text-white"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowDropdown(false);
              }}
              className="absolute right-3 top-2 p-0.5 hover:bg-slate-100 rounded-full cursor-pointer text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {showDropdown && searchResults.length > 0 && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-transparent" 
              onClick={() => setShowDropdown(false)} 
            />
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.map((sec) => (
                <button
                   key={sec.id}
                   onClick={() => {
                     setSelectedSecurity(sec);
                     setSelectedIndexId(null);
                     setSearchQuery('');
                     setShowDropdown(false);
                   }}
                   className="w-full px-4 py-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                >
                  <div>
                    <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center">
                      {sec.ticker}
                      {sec.status === 'INACTIVE' && (
                        <span className="ml-1.5 inline-flex items-center px-1 py-0.2 rounded text-[8px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/40 dark:border-slate-700/30 normal-case tracking-normal">
                          Defunct
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">{sec.companyName}</div>
                  </div>
                  <Badge variant={sec.exchangeId === 'GASCI' ? 'blue' : 'yellow'}>{sec.exchangeId}</Badge>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedSecurity ? (
        <div className="space-y-4">
          <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-300">
            <div className="w-full p-4 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center">
                  Market Profile & Fundamentals
                  {selectedSecurity.status === 'INACTIVE' && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 normal-case tracking-normal">
                      Defunct
                    </span>
                  )}
                </span>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{selectedSecurity.companyName} • {selectedExInfo?.exchangeName}</p>
              </div>
              <div className="flex items-center space-x-3 shrink-0">
                <div className="text-right">
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {selectedLastPrice > 0 ? formatMoney(selectedLastPrice, selectedExInfo?.currency || 'USD') : 'No Price'}
                  </div>
                  {selectedLastPrice > 0 && (
                    <div className={`text-[10px] font-bold ${selectedChangePct >= 0 ? 'text-emerald-650 dark:text-emerald-450' : 'text-rose-650 dark:text-rose-455'}`}>
                      {selectedChangePct >= 0 ? '+' : ''}{selectedChangePct.toFixed(2)}%
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggleWatchlist(selectedSecurity.id)}
                  className={`p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ${watchlist.includes(selectedSecurity.id) ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400'}`}
                  title={watchlist.includes(selectedSecurity.id) ? "Remove from Watchlist" : "Add to Watchlist"}
                >
                  <Heart className={`w-4 h-4 ${watchlist.includes(selectedSecurity.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>
                <button
                  onClick={() => setSelectedSecurity(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-300"
                  title="Close profile"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900">
              {selectedSecurity.status === 'INACTIVE' && (
                <div className="mx-4 mt-4 p-3 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-650 dark:text-slate-400 flex items-start space-x-2.5 leading-normal">
                  <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">Delisted / Defunct Equity</div>
                    <p className="mt-0.5">
                      This security is no longer actively listed or traded. Historical data is preserved for ledger consistency.
                    </p>
                  </div>
                </div>
              )}
              {/* 2.1 Metadata Details */}
              <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Country</span>
                  <span className="font-medium text-slate-900 dark:text-white">{selectedExInfo?.country}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Sector</span>
                  <span className="font-medium text-slate-900 dark:text-white">{selectedSecurity.sector}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Currency</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedExInfo?.currency}</span>
                </div>
              </div>

              {/* 2.2 Latest Research Synopsis (if any) */}
              {selectedLatestNote && (
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 leading-normal">
                    <div className="font-semibold text-blue-800 dark:text-blue-450 mb-1 flex items-center">
                      <Info className="w-3.5 h-3.5 mr-1" />
                      Latest Synopsis ({selectedLatestNote.date})
                    </div>
                    <div className="font-medium text-slate-900 dark:text-white mb-1">{selectedLatestNote.title}</div>
                    <p className="text-slate-600 dark:text-slate-400">{selectedLatestNote.synopsis}</p>
                  </div>
                </div>
              )}

              {/* 2.3 Interactive Pricing Line Chart */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Price History</span>
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 space-x-1">
                    {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map(range => (
                      <button
                        key={range}
                        onClick={() => setChartRange(range)}
                        className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${chartRange === range ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-48 w-full bg-white dark:bg-slate-900">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedPriceHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} dy={10} minTickGap={15} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} domain={['auto', 'auto']} tickFormatter={(val) => val.toFixed(0)} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                        labelStyle={{ fontSize: '12px', color: theme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: '4px' }}
                        itemStyle={{ fontSize: '14px', fontWeight: 'bold', color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                        formatter={(value: number) => [`${selectedExInfo?.currency || 'USD'} ${value.toFixed(2)}`, 'Price']}
                      />
                      <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2.4 Fundamentals */}
              {selectedFundamentals && (
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fundamentals & Metrics</span>
                    <span className="text-[9px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 px-2 py-0.5 rounded uppercase font-bold">
                      {selectedLatestNote ? 'From note synopsis' : `As of ${selectedFundamentals.lastUpdated || 'Unknown'}`}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">P/E Ratio</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedFundamentals.peRatio?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">EPS</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedFundamentals.eps ? formatMoney(selectedFundamentals.eps, selectedExInfo?.currency || 'USD') : 'N/A'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Div. Yield</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedFundamentals.dividendYield ? `${selectedFundamentals.dividendYield.toFixed(1)}%` : 'N/A'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">P/B Ratio</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedFundamentals.pbRatio?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">ROE</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedFundamentals.roe ? `${selectedFundamentals.roe.toFixed(1)}%` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
          
          <button
            onClick={() => setSelectedSecurity(null)}
            className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold flex justify-center items-center text-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Markets Overview
          </button>
        </div>
      ) : selectedIndexId && selectedIndexMetadata ? (
        <div className="space-y-4">
          <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-300">
            <div className="w-full p-4 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">Index Profile & Methodology</span>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{selectedIndexMetadata.name}</p>
              </div>
              <div className="flex items-center space-x-3 shrink-0">
                <div className="text-right">
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {selectedIndexMetadata.value.toFixed(1)}
                  </div>
                  <div className={`text-[10px] font-bold ${selectedIndexMetadata.change >= 0 ? 'text-emerald-650 dark:text-emerald-450' : 'text-rose-650 dark:text-rose-455'}`}>
                    {selectedIndexMetadata.change >= 0 ? '+' : ''}{selectedIndexMetadata.changePct.toFixed(2)}%
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIndexId(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-350"
                  title="Close index profile"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900">
              {/* Metadata Details */}
              <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Country</span>
                  <span className="font-medium text-slate-900 dark:text-white">{selectedIndexMetadata.country}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Currency</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedIndexMetadata.currency}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Scale Factor</span>
                  <span className="font-semibold text-slate-900 dark:text-white">x {selectedIndexMetadata.scale}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Last Active Session</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedIndexMetadata.latestDate}</span>
                </div>
              </div>

              {/* Interactive Chart */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Index Trend</span>
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 space-x-1">
                    {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map(range => (
                      <button
                        key={range}
                        onClick={() => setChartRange(range)}
                        className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${chartRange === range ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-205'}`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-48 w-full bg-white dark:bg-slate-900">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedIndexHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} dy={10} minTickGap={15} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} domain={['auto', 'auto']} tickFormatter={(val) => val.toFixed(0)} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                        labelStyle={{ fontSize: '12px', color: theme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: '4px' }}
                        itemStyle={{ fontSize: '14px', fontWeight: 'bold', color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}
                        formatter={(value: number) => [`${value.toFixed(1)} pts`, 'Index Value']}
                      />
                      <Line type="monotone" dataKey="rawValue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Index Constituents Collapsible Dropdown Accordion */}
              <button
                onClick={() => setIsCompositionExpanded(!isCompositionExpanded)}
                className="w-full px-4 py-3 flex justify-between items-center bg-slate-50/30 dark:bg-slate-950/10 border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors duration-200 text-left font-bold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest cursor-pointer"
              >
                <span className="flex items-center">
                  Index Constituents & Weights
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded ml-2 normal-case tracking-normal border border-slate-200/40 dark:border-slate-700/20">
                    {(activeIndexDef?.constituentIds || []).length} Equities
                  </span>
                </span>
                {isCompositionExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                )}
              </button>

              {isCompositionExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Methodology Explanation */}
                  <div className="p-4 bg-slate-50/30 dark:bg-slate-950/10">
                    <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-150 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-350 leading-relaxed space-y-2">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center">
                        <Info className="w-3.5 h-3.5 mr-1 text-blue-500" />
                        Methodology: Equal-Weighted Price Index
                      </div>
                      <p>
                        This index is constructed as a simple equal-weighted average of the closing prices of all constituent equities listed on the {selectedIndexMetadata.name}. The raw average is multiplied by a scaling factor of <strong>x{selectedIndexMetadata.scale}</strong> to align starting reference levels.
                      </p>
                      <p className="font-medium text-slate-850 dark:text-slate-200">
                        Formula: Index Level = (Sum of Prices / N) &times; {selectedIndexMetadata.scale}
                      </p>
                    </div>
                  </div>

                  {/* Index Constituents Table */}
                  <div className="p-4 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {securities
                      .filter(s => activeIndexDef?.constituentIds.includes(s.id))
                      .map(sec => {
                        const count = activeIndexDef?.constituentIds.length || 1;
                        const weightPct = (1 / count) * 100;
                        return (
                          <div key={sec.id} className="py-3 flex justify-between items-center hover:bg-slate-55/50 dark:hover:bg-slate-800/35 px-1 rounded-lg transition-colors">
                            <button
                              onClick={() => {
                                setSelectedSecurity(sec);
                                setSelectedIndexId(null);
                              }}
                              className="font-bold text-blue-600 dark:text-blue-400 hover:underline text-left cursor-pointer transition-colors"
                            >
                              {sec.ticker}
                              {sec.status === 'INACTIVE' && (
                                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-650 border border-slate-200 normal-case tracking-normal">
                                  Defunct
                                </span>
                              )}
                              <span className="font-normal text-xs text-slate-500 dark:text-slate-400 ml-1">— {sec.companyName}</span>
                            </button>
                            <span className="font-semibold text-slate-900 dark:text-white text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/50">
                              {weightPct.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <button
            onClick={() => setSelectedIndexId(null)}
            className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold flex justify-center items-center text-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Markets Overview
          </button>
        </div>
      ) : (
        <>
          {/* Market Indices Panel */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(() => {
              return indices.map(idx => {
                const indexData = indicesSummary[idx.id];
                const colorClass = idx.color === 'emerald' ? 'text-emerald-500 dark:text-emerald-400' :
                                   idx.color === 'yellow' ? 'text-yellow-500 dark:text-yellow-400' :
                                   idx.color === 'green' ? 'text-green-500 dark:text-green-400' :
                                   idx.color === 'cyan' ? 'text-cyan-500 dark:text-cyan-400' :
                                   'text-blue-500 dark:text-blue-400';
                return (
                  <Card 
                    key={idx.id}
                    onClick={() => {
                      setSelectedIndexId(idx.id as any);
                      setIsCompositionExpanded(false);
                    }}
                    className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white relative overflow-hidden group transition-colors duration-300 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 select-none"
                  >
                    <div className="absolute top-0 right-0 p-6 text-slate-100/10 dark:text-slate-800/10 font-extrabold text-5xl pointer-events-none select-none">{idx.flag}</div>
                    <CardContent className="p-4 flex flex-col justify-between h-24 relative z-10">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center">
                          <TrendingUp className={`w-3.5 h-3.5 mr-1 ${colorClass}`} /> 
                          {idx.name}
                        </span>
                        <span>{idx.id === 'GASCI' ? 'GYD' : idx.id === 'BSE' ? 'BBD' : idx.id === 'JSE' ? 'JMD' : idx.id === 'TTSE' ? 'TTD' : 'XCD'}</span>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-2xl font-black tracking-tight">
                          {indexData && indexData.value > 0 ? indexData.value.toFixed(1) : '1,000.0'}
                        </span>
                        {indexData && (
                          <span className={`text-xs font-semibold flex items-center px-1.5 py-0.5 rounded ${indexData.change >= 0 ? 'text-emerald-650 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/20' : 'text-rose-650 bg-rose-500/10 dark:text-rose-450 dark:bg-rose-500/20'}`}>
                            {indexData.change >= 0 ? '+' : ''}{indexData.changePct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              });
            })()}
          </div>

          {/* Market Overview & Biggest Movers */}
          <Card>
            <CardContent className="p-5">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 flex-wrap gap-3">
                <div>
                  <div className="font-bold text-sm uppercase tracking-wide text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span>Movers for the Markets</span>
                    {currentSessionDate && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/50">
                        Session: {currentSessionDate}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Top gainers and losers by percentage price change.</div>
                </div>
                
                {/* Filter Swaps */}
                <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg text-xs font-semibold border border-transparent dark:border-slate-700/30">
                  {(['ALL', 'GASCI', 'BSE', 'JSE', 'TTSE', 'ECSE'] as const).map(ex => (
                    <button
                      key={ex}
                      onClick={() => setSelectedExchange(ex)}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                        selectedExchange === ex
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/40 dark:border-slate-700/30'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-250'
                      }`}
                    >
                      {ex === 'ALL' ? 'All' : ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Gainers Column */}
                <div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-widest mb-3 border-b border-slate-50 dark:border-slate-800 pb-1.5 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Top Gainers</span>
                  </div>
                  <div className="space-y-3.5">
                    {marketGainers.length === 0 ? (
                      <div className="text-slate-400 dark:text-slate-500 text-xs py-4 text-center">No daily gainers recorded.</div>
                    ) : (
                      marketGainers.map(mover => {
                        const isWatched = watchlist.includes(mover.security.id);
                        const currency = mover.security.currency || exchanges.find(e => e.id === mover.security.exchangeId)?.currency || 'USD';
                        return (
                          <Link 
                            to={`/holdings/${mover.security.id}`}
                            key={mover.security.id}
                            className="flex justify-between items-center hover:bg-slate-50/80 dark:hover:bg-slate-800/50 p-2.5 -mx-2.5 rounded-xl transition-all block cursor-pointer"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              {/* Watchlist Star */}
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleWatchlist(mover.security.id);
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors shrink-0 cursor-pointer"
                              >
                                <Star className={`w-4 h-4 ${isWatched ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                              </button>
                              
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-extrabold text-slate-900 dark:text-white text-sm tracking-tight">{mover.security.ticker}</span>
                                  <Badge variant={mover.security.exchangeId === 'GASCI' ? 'blue' : 'yellow'}>
                                    {mover.security.exchangeId}
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-slate-450 dark:text-slate-400 truncate max-w-[130px] sm:max-w-[280px] md:max-w-[180px] lg:max-w-[280px] xl:max-w-[380px] mt-0.5">
                                  {mover.security.companyName}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-3">
                              <div>
                                <div className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
                                  {formatMoney(mover.currentPrice, currency)}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Last Price</div>
                              </div>
                              <span className="px-2.5 py-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg flex items-center gap-0.5 shrink-0">
                                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                {formatPercentage(mover.changePct)}
                              </span>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Losers Column */}
                <div>
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-455 uppercase tracking-widest mb-3 border-b border-slate-55 dark:border-slate-800 pb-1.5 flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Top Losers</span>
                  </div>
                  <div className="space-y-3.5">
                    {marketLosers.length === 0 ? (
                      <div className="text-slate-400 dark:text-slate-500 text-xs py-4 text-center">No daily losers recorded.</div>
                    ) : (
                      marketLosers.map(mover => {
                        const isWatched = watchlist.includes(mover.security.id);
                        const currency = mover.security.currency || exchanges.find(e => e.id === mover.security.exchangeId)?.currency || 'USD';
                        return (
                          <Link 
                            to={`/holdings/${mover.security.id}`}
                            key={mover.security.id}
                            className="flex justify-between items-center hover:bg-slate-50/80 dark:hover:bg-slate-800/50 p-2.5 -mx-2.5 rounded-xl transition-all block cursor-pointer"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              {/* Watchlist Star */}
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleWatchlist(mover.security.id);
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors shrink-0 cursor-pointer"
                              >
                                <Star className={`w-4 h-4 ${isWatched ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                              </button>
                              
                              <div className="min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-extrabold text-slate-900 dark:text-white text-sm tracking-tight">{mover.security.ticker}</span>
                                  <Badge variant={mover.security.exchangeId === 'GASCI' ? 'blue' : 'yellow'}>
                                    {mover.security.exchangeId}
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-slate-450 dark:text-slate-400 truncate max-w-[130px] sm:max-w-[280px] md:max-w-[180px] lg:max-w-[280px] xl:max-w-[380px] mt-0.5">
                                  {mover.security.companyName}
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-3">
                              <div>
                                <div className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
                                  {formatMoney(mover.currentPrice, currency)}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Last Price</div>
                              </div>
                              <span className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-lg flex items-center gap-0.5 shrink-0">
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

          {/* Relevant News Feed */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center space-x-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Newspaper className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
                <div className="font-bold text-sm uppercase tracking-wide text-slate-800 dark:text-slate-200">Relevant Corporate News</div>
              </div>
              
              <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
                {latestNews.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-center text-slate-400 dark:text-slate-500">
                    <HelpCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="text-sm">No recent investment notes logged.</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[280px] mt-1">Add research journal synopses on security pages to populate the feed.</p>
                  </div>
                ) : (
                  latestNews.map((news, index) => {
                    const sec = securities.find(s => s.id === news.securityId);
                    return (
                      <Link 
                        to={`/holdings/${news.securityId}`}
                        key={news.id}
                        className={`block hover:bg-slate-55 dark:hover:bg-slate-800/40 p-3 rounded-xl transition-colors ${index > 0 ? 'pt-4 border-t border-transparent dark:border-slate-800/30' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-slate-900 dark:text-white text-sm">{sec?.ticker || 'Security'}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-semibold">{news.date}</span>
                          </div>
                          <Badge variant={sec?.exchangeId === 'GASCI' ? 'blue' : 'yellow'}>{sec?.exchangeId}</Badge>
                        </div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 text-xs mb-1.5 leading-snug">{news.title}</div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs line-clamp-3 leading-relaxed">{news.synopsis}</div>
                      </Link>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
