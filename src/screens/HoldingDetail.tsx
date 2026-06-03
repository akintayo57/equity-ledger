import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { Card, CardHeader, CardContent, StatBox, Badge } from '../components/ui/Cards';
import { formatMoney, formatPercentage } from '../utils';
import { ArrowLeft, Clock, AlertTriangle, Eye, EyeOff, BookOpen, UserPlus, Info, Newspaper, PlusCircle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import React, { useMemo, useState } from 'react';

export const HoldingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { holdings, transactions, securities, prices, exchanges, watchlist, equityNotes, toggleWatchlist, addEquityNote } = useStore();

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'RESEARCH'>('OVERVIEW');

  const holding = holdings.find((h) => h.security.id === id);
  const security = holding?.security || securities.find(s => s.id === id);

  // Form states for new note
  const [noteTitle, setNoteTitle] = useState('');
  const [noteSynopsis, setNoteSynopsis] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [notePe, setNotePe] = useState('');
  const [noteEps, setNoteEps] = useState('');
  const [noteDivYield, setNoteDivYield] = useState('');
  const [notePb, setNotePb] = useState('');
  const [noteRoe, setNoteRoe] = useState('');
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);

  if (!security) {
    return <div className="p-4">Security not found.</div>;
  }

  const isWatched = watchlist.includes(security.id);

  // Resolve exchange info
  const exInfo = useMemo(() => {
    const ex = exchanges.find(e => e.id === security.exchangeId);
    return {
      country: ex ? ex.country : 'Unknown',
      currency: security.currency || (ex ? ex.currency : 'USD'),
      exchangeName: ex ? ex.name : (security.exchangeId || 'Unknown')
    };
  }, [security, exchanges]);

  // Find all research notes for this security
  const notes = useMemo(() => {
    return equityNotes
      .filter(n => n.securityId === security.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [equityNotes, security.id]);

  const latestNote = notes.length > 0 ? notes[0] : null;

  // Ratios to display (prioritize latest note, fall back to security fundamentals)
  const fundamentals = useMemo(() => {
    if (latestNote) {
      return {
        peRatio: latestNote.peRatio,
        eps: latestNote.eps,
        dividendYield: latestNote.dividendYield,
        pbRatio: latestNote.pbRatio,
        roe: latestNote.roe,
        lastUpdated: latestNote.date
      };
    }
    return security.fundamentals;
  }, [security.fundamentals, latestNote]);

  const holdingTxs = transactions
    .filter((tx) => tx.securityId === id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const isGreen = holding ? holding.unrealizedGainLossPctUSD >= 0 : true;
  const isStale = holding ? holding.priceStaleStatus === 'STALE' || holding.priceStaleStatus === 'VERY_STALE' : false;

  const secPrices = prices.filter(p => p.securityId === security.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastPrice = secPrices.length > 0 ? secPrices[0].price : 0;
  const lastPriceDate = secPrices.length > 0 ? secPrices[0].date : null;

  const [chartRange, setChartRange] = useState<'1M' | '3M' | '6M' | '1Y'>('6M');

  const priceHistory = useMemo(() => {
    let daysToLookBack = 180;
    let getLabel = (d: Date) => format(d, 'MMM dd');

    if (chartRange === '1M') { daysToLookBack = 30; getLabel = (d: Date) => format(d, 'dd MMM'); }
    else if (chartRange === '3M') { daysToLookBack = 90; getLabel = (d: Date) => format(d, 'dd MMM'); }
    else if (chartRange === '6M') { daysToLookBack = 180; getLabel = (d: Date) => format(d, 'MMM yy'); }
    else if (chartRange === '1Y') { daysToLookBack = 365; getLabel = (d: Date) => format(d, 'MMM yy'); }

    const startDate = new Date(Date.now() - daysToLookBack * 86400000);
    
    const filteredRealData = secPrices
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

    const fallbackPrice = lastPrice || 0;
    return [
      { date: getLabel(startDate), price: fallbackPrice },
      { date: getLabel(new Date()), price: fallbackPrice }
    ];
  }, [secPrices, lastPrice, chartRange]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle || !noteSynopsis) return;

    try {
      await addEquityNote({
        securityId: security.id,
        date: noteDate,
        title: noteTitle,
        synopsis: noteSynopsis,
        peRatio: notePe ? Number(notePe) : undefined,
        eps: noteEps ? Number(noteEps) : undefined,
        dividendYield: noteDivYield ? Number(noteDivYield) : undefined,
        pbRatio: notePb ? Number(notePb) : undefined,
        roe: noteRoe ? Number(noteRoe) : undefined
      });

      // Reset form states
      setNoteTitle('');
      setNoteSynopsis('');
      setNotePe('');
      setNoteEps('');
      setNoteDivYield('');
      setNotePb('');
      setNoteRoe('');
      setShowAddNoteForm(false);
    } catch (err) {
      alert(`Failed to add research note: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full border border-slate-200 shadow-sm cursor-pointer">
            <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight">{security.ticker}</h2>
            <div className="text-xs text-slate-500">{security.companyName}</div>
          </div>
        </div>
        <button 
          onClick={() => toggleWatchlist(security.id)} 
          className={`p-2 rounded-full border shadow-sm transition-colors cursor-pointer ${isWatched ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600'}`}
        >
          {isWatched ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200 rounded-lg">
        <button 
          onClick={() => setActiveTab('OVERVIEW')}
          className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${activeTab === 'OVERVIEW' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('RESEARCH')}
          className={`py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center space-x-1 cursor-pointer ${activeTab === 'RESEARCH' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
        >
          <BookOpen className="w-3.5 h-3.5 mr-1" />
          Research Journal ({notes.length})
        </button>
      </div>

      {activeTab === 'OVERVIEW' && (
        <>
          {/* Equity Info Section */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Equity Metadata</span>
                <span className="text-xs text-slate-500">{exInfo.exchangeName} • {exInfo.country}</span>
              </div>
              
              {latestNote && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-xs text-slate-700 leading-normal">
                  <div className="font-semibold text-blue-800 mb-1 flex items-center">
                    <Info className="w-3.5 h-3.5 mr-1" />
                    Latest Synopsis ({latestNote.date})
                  </div>
                  <div className="font-medium text-slate-900 mb-1">{latestNote.title}</div>
                  <p className="line-clamp-3 text-slate-600">{latestNote.synopsis}</p>
                </div>
              )}

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Sector</span>
                <span className="font-medium text-slate-900">{security.sector}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Listed Currency</span>
                <span className="font-semibold text-slate-900">{exInfo.currency}</span>
              </div>
            </CardContent>
          </Card>

          {/* Interactive Pricing Line Chart */}
          <Card className={isStale ? 'border-amber-200 bg-amber-50' : ''}>
            <CardContent className="p-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-start space-x-3">
                {isStale ? <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" /> : <Clock className="w-5 h-5 text-slate-400 shrink-0" />}
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    Last Price: {formatMoney(lastPrice, exInfo.currency)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    As of {lastPriceDate ? format(new Date(lastPriceDate), 'MMM d, yyyy') : 'Unknown'}
                  </div>
                </div>
              </div>
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
            </CardContent>
            <div className="p-4 h-48 w-full bg-white">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} minTickGap={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={['auto', 'auto']} tickFormatter={(val) => val.toFixed(0)} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}
                    itemStyle={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}
                    formatter={(value: number) => [`${exInfo.currency} ${value.toFixed(2)}`, 'Price']}
                  />
                  <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Fundamentals Card (Resolved from last Note or base) */}
          {fundamentals && (
            <Card>
              <CardHeader 
                title="Fundamentals & Metrics" 
                action={
                  <span className="text-[9px] text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase font-bold">
                    {latestNote ? 'From note synopsis' : `As of ${fundamentals.lastUpdated || 'Unknown'}`}
                  </span>
                } 
              />
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  <div className="p-3 flex justify-between text-sm">
                    <span className="text-slate-500">P/E Ratio</span>
                    <span className="font-medium text-slate-900">{fundamentals.peRatio?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="p-3 flex justify-between text-sm">
                    <span className="text-slate-500">EPS</span>
                    <span className="font-medium text-slate-900">{fundamentals.eps ? formatMoney(fundamentals.eps, exInfo.currency) : 'N/A'}</span>
                  </div>
                  <div className="p-3 flex justify-between text-sm">
                    <span className="text-slate-500">Div. Yield</span>
                    <span className="font-medium text-slate-900">{fundamentals.dividendYield ? `${fundamentals.dividendYield.toFixed(1)}%` : 'N/A'}</span>
                  </div>
                  <div className="p-3 flex justify-between text-sm">
                    <span className="text-slate-500">P/B Ratio</span>
                    <span className="font-medium text-slate-900">{fundamentals.pbRatio?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="p-3 flex justify-between text-sm">
                    <span className="text-slate-500">ROE</span>
                    <span className="font-medium text-slate-900">{fundamentals.roe ? `${fundamentals.roe.toFixed(1)}%` : 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Holdings Return Section */}
          {holding && (
            <>
              <Card className="bg-slate-900 border-slate-800 text-white shadow-md">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Market Value (USD)</div>
                      <div className="text-3xl font-bold">{formatMoney(holding.marketValueUSD, 'USD')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Return</div>
                      <div className={isGreen ? 'text-emerald-400 text-lg font-bold' : 'text-rose-400 text-lg font-bold'}>
                        {isGreen ? '+' : ''}{formatPercentage(holding.unrealizedGainLossPctUSD)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 border-t border-slate-700 pt-4 mt-4 text-xs">
                    <div>
                      <div className="text-slate-400 mb-1">Local Value</div>
                      <div className="font-medium">{formatMoney(holding.marketValueLocal, exInfo.currency)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 mb-1">Cost Basis (USD)</div>
                      <div className="font-medium">{formatMoney(holding.totalCostBasisUSD, 'USD')}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 mb-1">Realized Dividends</div>
                      <div className="font-semibold text-blue-400">{formatMoney(holding.totalDividendsUSD, 'USD')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <StatBox label="Shares" value={holding.sharesOwned.toLocaleString()} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <StatBox label="Avg Cost" value={formatMoney(holding.averageCost, exInfo.currency)} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <StatBox label="Weight" value={`${holding.portfolioWeight.toFixed(1)}%`} />
                  </CardContent>
                </Card>
              </div>

              {holding.hasUncertainty && (
                <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 flex items-start space-x-3 text-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold">Estimated Cost Basis & Returns</div>
                    <p className="text-slate-600 leading-normal">
                      This holding contains transactions with estimated cost basis (e.g. inherited shares or predate exchange). Gains and returns are calculated as estimates.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Transactions Book summary for specific holdings */}
          {holdingTxs.length > 0 && (
            <Card>
              <CardHeader title="Recent Transactions" />
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {holdingTxs.map((tx) => (
                    <div key={tx.id} className="p-3 flex justify-between items-center text-sm">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className={`font-semibold text-xs ${
                            tx.type === 'BUY' 
                              ? 'text-emerald-700' 
                              : tx.type === 'SELL' 
                              ? 'text-rose-700' 
                              : tx.type === 'INHERIT'
                              ? 'text-amber-700'
                              : tx.type === 'SPLIT'
                              ? 'text-blue-700 font-bold'
                              : 'text-slate-900'
                          }`}>
                            {tx.type}
                          </span>
                          {tx.isUncertain && (
                            <span className="text-[8px] font-semibold text-amber-600 bg-amber-50 px-1 rounded">
                              Est.
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">{tx.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-slate-900">
                          {tx.type === 'SPLIT' ? `Ratio ${tx.shares}` : `${tx.shares} shs`}
                        </div>
                        <div className="text-xs text-slate-500">
                          {tx.type === 'INHERIT' 
                            ? 'Inherited' 
                            : tx.type === 'SPLIT' 
                            ? 'Stock Split' 
                            : `@ ${formatMoney(tx.pricePerShare, exInfo.currency)}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === 'RESEARCH' && (
        <div className="space-y-4">
          {/* Add Research Note Button */}
          {!showAddNoteForm ? (
            <button 
              onClick={() => setShowAddNoteForm(true)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex justify-center items-center text-sm shadow-md transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 mr-2" /> Log Business Note
            </button>
          ) : (
            <Card className="bg-slate-50 border-blue-200">
              <CardHeader title="Write Research Synopsis" />
              <CardContent className="p-4">
                <form onSubmit={handleAddNote} className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Title</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Q4 Revenue surge & board restructuring" 
                      value={noteTitle} 
                      onChange={e => setNoteTitle(e.target.value)} 
                      className="w-full text-sm border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Date</label>
                      <input 
                        type="date" 
                        required 
                        value={noteDate} 
                        onChange={e => setNoteDate(e.target.value)} 
                        className="w-full text-sm border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">P/E Ratio (Optional)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={notePe} 
                        onChange={e => setNotePe(e.target.value)} 
                        className="w-full text-sm border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Synopsis (Acquisitions, Mergers, Leadership Changes, Buildings, etc.)</label>
                    <textarea 
                      required
                      rows={4}
                      placeholder="Enter detailed corporate synopsis..."
                      value={noteSynopsis}
                      onChange={e => setNoteSynopsis(e.target.value)}
                      className="w-full text-sm border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">EPS ({exInfo.currency})</label>
                      <input type="number" step="0.01" value={noteEps} onChange={e => setNoteEps(e.target.value)} className="w-full text-xs border border-slate-300 rounded p-1 focus:ring-blue-500 focus:outline-none bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Div Yield (%)</label>
                      <input type="number" step="0.01" value={noteDivYield} onChange={e => setNoteDivYield(e.target.value)} className="w-full text-xs border border-slate-300 rounded p-1 focus:ring-blue-500 focus:outline-none bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">P/B Ratio</label>
                      <input type="number" step="0.01" value={notePb} onChange={e => setNotePb(e.target.value)} className="w-full text-xs border border-slate-300 rounded p-1 focus:ring-blue-500 focus:outline-none bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">ROE (%)</label>
                      <input type="number" step="0.01" value={noteRoe} onChange={e => setNoteRoe(e.target.value)} className="w-full text-xs border border-slate-300 rounded p-1 focus:ring-blue-500 focus:outline-none bg-white" />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button type="button" onClick={() => setShowAddNoteForm(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded cursor-pointer">Cancel</button>
                    <button type="submit" className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors cursor-pointer">Save Synopsis</button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* List of logged corporate notes */}
          <div className="space-y-4">
            {notes.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                No notes logged for this security.
              </div>
            ) : (
              notes.map(note => (
                <Card key={note.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{note.title}</h4>
                        <span className="text-[10px] text-slate-400">{note.date}</span>
                      </div>
                      <Badge variant="blue">Synopsis</Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal whitespace-pre-wrap">{note.synopsis}</p>
                    
                    {(note.peRatio || note.eps || note.dividendYield || note.pbRatio || note.roe) && (
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-[10px] text-slate-500 grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {note.peRatio && <div>P/E: <span className="font-semibold text-slate-800">{note.peRatio.toFixed(1)}</span></div>}
                        {note.eps && <div>EPS: <span className="font-semibold text-slate-800">{formatMoney(note.eps, exInfo.currency)}</span></div>}
                        {note.dividendYield && <div>Yield: <span className="font-semibold text-slate-800">{note.dividendYield.toFixed(1)}%</span></div>}
                        {note.pbRatio && <div>P/B: <span className="font-semibold text-slate-800">{note.pbRatio.toFixed(1)}</span></div>}
                        {note.roe && <div>ROE: <span className="font-semibold text-slate-800">{note.roe.toFixed(1)}%</span></div>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
