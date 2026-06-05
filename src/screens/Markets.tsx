import { useStore } from '../store';
import { Card, CardContent, Badge } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { Star, TrendingUp, Newspaper, HelpCircle, ArrowUpRight, ArrowDownRight, Search, X, ArrowLeft, Info, Heart } from 'lucide-react';
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
    toggleWatchlist 
  } = useStore();

  const [selectedExchange, setSelectedExchange] = useState<'ALL' | 'GASCI' | 'BSE' | 'JSE' | 'TTSE'>('ALL');

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSecurity, setSelectedSecurity] = useState<any | null>(null);
  const [chartRange, setChartRange] = useState<'1M' | '3M' | '6M' | '1Y'>('6M');

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

    if (chartRange === '1M') { daysToLookBack = 30; getLabel = (d: Date) => format(d, 'dd MMM'); }
    else if (chartRange === '3M') { daysToLookBack = 90; getLabel = (d: Date) => format(d, 'dd MMM'); }
    else if (chartRange === '6M') { daysToLookBack = 180; getLabel = (d: Date) => format(d, 'MMM yy'); }
    else if (chartRange === '1Y') { daysToLookBack = 365; getLabel = (d: Date) => format(d, 'MMM yy'); }

    const startDate = new Date(Date.now() - daysToLookBack * 86400000);
    
    const filteredRealData = selectedSecPrices
      .filter(p => new Date(p.date) >= startDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (filteredRealData.length > 0) {
      const data = filteredRealData.map(p => ({
        date: getLabel(new Date(p.date)),
        price: p.price
      }));

      if (data.length === 1) {
        return [
          { date: getLabel(startDate), price: data[0].price },
          data[0]
        ];
      }
      return data;
    }

    const fallbackPrice = selectedLastPrice || 0;
    return [
      { date: getLabel(startDate), price: fallbackPrice },
      { date: getLabel(new Date()), price: fallbackPrice }
    ];
  }, [selectedSecPrices, selectedLastPrice, chartRange, selectedSecurity]);

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

  // Find the global latest price date across all exchanges
  const globalLatestDate = useMemo(() => {
    const dates = Object.values(latestDateByExchange);
    if (dates.length === 0) return null;
    return dates.reduce((latest, current) => current > latest ? current : latest, dates[0]);
  }, [latestDateByExchange]);

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
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Markets</h2>
        <p className="text-xs text-slate-500">Live indices, daily price changes, and corporate synopses across Caribbean exchanges.</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search all equities across exchanges..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
              {searchResults.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => {
                    setSelectedSecurity(sec);
                    setSearchQuery('');
                    setShowDropdown(false);
                  }}
                  className="w-full px-4 py-3 flex justify-between items-center hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">{sec.ticker}</div>
                    <div className="text-xs text-slate-450 truncate max-w-[200px] sm:max-w-xs">{sec.companyName}</div>
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
          <Card className="overflow-hidden border border-slate-200">
            <div className="w-full p-4 flex justify-between items-center bg-white border-b border-slate-100">
              <div>
                <span className="font-bold text-sm text-slate-900">Market Profile & Fundamentals</span>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedSecurity.companyName} • {selectedExInfo?.exchangeName}</p>
              </div>
              <div className="flex items-center space-x-3 shrink-0">
                <div className="text-right">
                  <div className="font-extrabold text-sm text-slate-900">
                    {selectedLastPrice > 0 ? formatMoney(selectedLastPrice, selectedExInfo?.currency || 'USD') : 'No Price'}
                  </div>
                  {selectedLastPrice > 0 && (
                    <div className={`text-[10px] font-bold ${selectedChangePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {selectedChangePct >= 0 ? '+' : ''}{selectedChangePct.toFixed(2)}%
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggleWatchlist(selectedSecurity.id)}
                  className={`p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ${watchlist.includes(selectedSecurity.id) ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                  title={watchlist.includes(selectedSecurity.id) ? "Remove from Watchlist" : "Add to Watchlist"}
                >
                  <Heart className={`w-4 h-4 ${watchlist.includes(selectedSecurity.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                </button>
                <button
                  onClick={() => setSelectedSecurity(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-slate-650"
                  title="Close profile"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-white">
              {/* 2.1 Metadata Details */}
              <div className="p-4 bg-slate-50/50 space-y-3 border-b border-slate-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Country</span>
                  <span className="font-medium text-slate-900">{selectedExInfo?.country}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Sector</span>
                  <span className="font-medium text-slate-900">{selectedSecurity.sector}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Currency</span>
                  <span className="font-semibold text-slate-900">{selectedExInfo?.currency}</span>
                </div>
              </div>

              {/* 2.2 Latest Research Synopsis (if any) */}
              {selectedLatestNote && (
                <div className="p-4 border-b border-slate-100">
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-xs text-slate-700 leading-normal">
                    <div className="font-semibold text-blue-800 mb-1 flex items-center">
                      <Info className="w-3.5 h-3.5 mr-1" />
                      Latest Synopsis ({selectedLatestNote.date})
                    </div>
                    <div className="font-medium text-slate-900 mb-1">{selectedLatestNote.title}</div>
                    <p className="text-slate-600">{selectedLatestNote.synopsis}</p>
                  </div>
                </div>
              )}

              {/* 2.3 Interactive Pricing Line Chart */}
              <div className="p-4 border-b border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Price History</span>
                  <div className="flex bg-slate-100 rounded-lg p-0.5 space-x-1">
                    {(['1M', '3M', '6M', '1Y'] as const).map(range => (
                      <button
                        key={range}
                        onClick={() => setChartRange(range)}
                        className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors cursor-pointer ${chartRange === range ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-48 w-full bg-white">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedPriceHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} minTickGap={15} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} tickFormatter={(val) => val.toFixed(0)} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}
                        itemStyle={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}
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
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fundamentals & Metrics</span>
                    <span className="text-[9px] text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase font-bold">
                      {selectedLatestNote ? 'From note synopsis' : `As of ${selectedFundamentals.lastUpdated || 'Unknown'}`}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 text-sm">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">P/E Ratio</span>
                      <span className="font-medium text-slate-900">{selectedFundamentals.peRatio?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">EPS</span>
                      <span className="font-medium text-slate-900">{selectedFundamentals.eps ? formatMoney(selectedFundamentals.eps, selectedExInfo?.currency || 'USD') : 'N/A'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Div. Yield</span>
                      <span className="font-medium text-slate-900">{selectedFundamentals.dividendYield ? `${selectedFundamentals.dividendYield.toFixed(1)}%` : 'N/A'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">P/B Ratio</span>
                      <span className="font-medium text-slate-900">{selectedFundamentals.pbRatio?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">ROE</span>
                      <span className="font-medium text-slate-900">{selectedFundamentals.roe ? `${selectedFundamentals.roe.toFixed(1)}%` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
          
          <button
            onClick={() => setSelectedSecurity(null)}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex justify-center items-center text-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Markets Overview
          </button>
        </div>
      ) : (
        <>
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
                  <div className="font-bold text-sm uppercase tracking-wide text-slate-800 flex items-center gap-2">
                    <span>Movers for the Markets</span>
                    {currentSessionDate && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50">
                        Session: {currentSessionDate}
                      </span>
                    )}
                  </div>
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
        </>
      )}
    </div>
  );
};
