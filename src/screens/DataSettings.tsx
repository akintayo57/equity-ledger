import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, CardHeader, CardContent } from '../components/ui/Cards';
import { PlusCircle, Upload, Trash2, Edit2, Info, User, LogOut, Sun, Moon } from 'lucide-react';
import { Currency, Security, Fundamentals } from '../types';
import { ConfirmDialog, AlertDialog } from '../components/ui/Modal';
import { auth, signOut } from '../firebase';

export const DataSettings = () => {
  const { holdings } = useStore();
  const [activeSection, setActiveSection] = useState<'MARKET_DATA' | 'FUNDAMENTALS' | 'PROFILE' | 'ABOUT'>('MARKET_DATA');

  const stalePriceWarnings = holdings.filter(h => h.priceStaleStatus === 'STALE' || h.priceStaleStatus === 'VERY_STALE');
  const staleFXWarnings = holdings.filter(h => h.fxStaleStatus === 'STALE');

  return (
    <div className="space-y-4 pb-6">
      <div className="relative mb-4">
        <label htmlFor="settings-menu-select" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Settings Menu</label>
        <select
          id="settings-menu-select"
          value={activeSection}
          onChange={(e) => setActiveSection(e.target.value as any)}
          className="w-full text-sm font-medium border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none"
        >
          <option value="MARKET_DATA">Market Data (Prices & FX)</option>
          <option value="FUNDAMENTALS">Fundamentals (Ratios)</option>
          <option value="PROFILE">User Profile</option>
          <option value="ABOUT">App Info</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 top-6 flex items-center px-3 text-slate-500 dark:text-slate-400">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>

      {(stalePriceWarnings.length > 0 || staleFXWarnings.length > 0) && activeSection === 'MARKET_DATA' && (
        <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 font-medium">
          Data Needs Update: {stalePriceWarnings.length} stale prices, {staleFXWarnings.length} stale FX rates.
        </div>
      )}

      {activeSection === 'MARKET_DATA' && <MarketDataSection />}
      {activeSection === 'FUNDAMENTALS' && <FundamentalsSection />}
      {activeSection === 'PROFILE' && <ProfileSection />}
      {activeSection === 'ABOUT' && <AboutSection />}
    </div>
  );
};

const MarketDataSection = () => {
  const [subTab, setSubTab] = useState<'PRICES' | 'FX'>('PRICES');
  return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200 rounded-lg">
          <button 
            className={`py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${subTab === 'PRICES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setSubTab('PRICES')}
          >
            Prices
          </button>
          <button 
            className={`py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${subTab === 'FX' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            onClick={() => setSubTab('FX')}
          >
            FX Rates
          </button>
        </div>
        {subTab === 'PRICES' && <PriceUpdatesTab />}
        {subTab === 'FX' && <FXUpdatesTab />}
      </div>
  );
};

const FundamentalsSection = () => {
  const { securities, updateSecurity, exchanges } = useStore();
  const [csvText, setCsvText] = useState('');
  const [editingSecId, setEditingSecId] = useState<string | null>(null);

  // Custom modal states
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [secToDelete, setSecToDelete] = useState<string | null>(null);

  const getSecurityCurrency = (sec: Security) => {
    if (sec.currency) return sec.currency;
    const ex = exchanges.find(e => e.id === sec.exchangeId);
    return ex ? ex.currency : 'USD';
  };

  const handleImport = async () => {
    const lines = csvText.trim().split('\n');
    let imported = 0;
    
    try {
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length < 2) continue;
        const [ticker, peRatio, eps, dividendYield, pbRatio, roe, lastUpdated] = parts.map(p => p.trim());
        
        if (ticker.toLowerCase() === 'ticker') continue;
        
        const sec = securities.find(s => s.ticker.toLowerCase() === ticker.toLowerCase());
        if (sec) {
          const fundamentals: any = { ...sec.fundamentals };
          if (peRatio) fundamentals.peRatio = Number(peRatio);
          if (eps) fundamentals.eps = Number(eps);
          if (dividendYield) fundamentals.dividendYield = Number(dividendYield);
          if (pbRatio) fundamentals.pbRatio = Number(pbRatio);
          if (roe) fundamentals.roe = Number(roe);
          if (lastUpdated) fundamentals.lastUpdated = lastUpdated;
          
          await updateSecurity(sec.id, { fundamentals });
          imported++;
        }
      }
      
      setAlertMsg(`Imported fundamentals for ${imported} securities successfully.`);
      setAlertOpen(true);
      setCsvText('');
    } catch (err) {
      setAlertMsg(`Import failed: ${(err as Error).message}`);
      setAlertOpen(true);
    }
  };

  const handleDeletePrompt = (secId: string) => {
    setSecToDelete(secId);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (secToDelete) {
      try {
        await updateSecurity(secToDelete, { fundamentals: undefined });
        setSecToDelete(null);
      } catch (err) {
        setAlertMsg(`Delete failed: ${(err as Error).message}`);
        setAlertOpen(true);
      }
    }
  };

  return (
    <div className="space-y-4">
      {editingSecId ? (
        <EditFundamentalsForm 
          security={securities.find(s => s.id === editingSecId)!} 
          currency={getSecurityCurrency(securities.find(s => s.id === editingSecId)!)}
          onClose={() => setEditingSecId(null)} 
        />
      ) : (
        <>
          <Card>
            <CardHeader title="Import Ratios (CSV)" />
            <CardContent className="p-4 space-y-3 bg-white dark:bg-slate-900">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 p-2 bg-slate-50 dark:bg-slate-950 rounded border border-transparent dark:border-slate-800">
                Format: ticker, peRatio, eps, dividendYield, pbRatio, roe, lastUpdated (YYYY-MM-DD)
              </div>
              <textarea 
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder="GBTI, 10.5, 45.2, 2.1, 1.4, 15.2, 2023-12-31"
                className="w-full text-xs font-mono border border-slate-300 dark:border-slate-800 rounded p-2 h-24 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <button 
                onClick={handleImport} 
                disabled={!csvText.trim()}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 mr-2" /> Import CSV
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Manage Ratios" />
            <CardContent className="p-0 bg-white dark:bg-slate-900">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {securities.map(sec => {
                  const hasData = !!sec.fundamentals;
                  return (
                    <div key={sec.id} className="p-3 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{sec.ticker}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{sec.exchangeId}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {hasData ? (
                          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded mr-2">Data Present</span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mr-2">No Data</span>
                        )}
                        <button onClick={() => setEditingSecId(sec.id)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded cursor-pointer">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePrompt(sec.id)} 
                          disabled={!hasData}
                          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="Import Successful"
        message={alertMsg}
        type="success"
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setSecToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Fundamentals"
        message="Are you sure you want to delete the fundamentals ratios for this security?"
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

const EditFundamentalsForm = ({ security, currency, onClose }: { security: Security, currency: string, onClose: () => void }) => {
  const { updateSecurity } = useStore();
  const [peRatio, setPeRatio] = useState(security.fundamentals?.peRatio?.toString() || '');
  const [eps, setEps] = useState(security.fundamentals?.eps?.toString() || '');
  const [dividendYield, setDividendYield] = useState(security.fundamentals?.dividendYield?.toString() || '');
  const [pbRatio, setPbRatio] = useState(security.fundamentals?.pbRatio?.toString() || '');
  const [roe, setRoe] = useState(security.fundamentals?.roe?.toString() || '');
  const [lastUpdated, setLastUpdated] = useState(security.fundamentals?.lastUpdated || new Date().toISOString().split('T')[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fundamentals: Fundamentals = {
      peRatio: peRatio ? Number(peRatio) : undefined,
      eps: eps ? Number(eps) : undefined,
      dividendYield: dividendYield ? Number(dividendYield) : undefined,
      pbRatio: pbRatio ? Number(pbRatio) : undefined,
      roe: roe ? Number(roe) : undefined,
      lastUpdated: lastUpdated || undefined,
    };
    try {
      await updateSecurity(security.id, { fundamentals });
      onClose();
    } catch (err) {
      alert(`Failed to update fundamentals: ${(err as Error).message}`);
    }
  };

  return (
    <Card className="bg-slate-50/50 dark:bg-slate-950/40 border-blue-200 dark:border-blue-900/50">
      <CardHeader title={`Edit Ratios: ${security.ticker}`} />
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">P/E Ratio</label>
              <input type="number" step="0.01" value={peRatio} onChange={e => setPeRatio(e.target.value)} className="w-full text-sm border border-slate-300 dark:border-slate-850 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">EPS ({currency})</label>
              <input type="number" step="0.01" value={eps} onChange={e => setEps(e.target.value)} className="w-full text-sm border border-slate-300 dark:border-slate-850 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Div. Yield (%)</label>
              <input type="number" step="0.01" value={dividendYield} onChange={e => setDividendYield(e.target.value)} className="w-full text-sm border border-slate-300 dark:border-slate-850 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">P/B Ratio</label>
              <input type="number" step="0.01" value={pbRatio} onChange={e => setPbRatio(e.target.value)} className="w-full text-sm border border-slate-300 dark:border-slate-850 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">ROE (%)</label>
              <input type="number" step="0.01" value={roe} onChange={e => setRoe(e.target.value)} className="w-full text-sm border border-slate-300 dark:border-slate-850 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">As of Date</label>
              <input type="date" value={lastUpdated} onChange={e => setLastUpdated(e.target.value)} className="w-full text-sm border border-slate-300 dark:border-slate-850 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">Save</button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const ProfileSection = () => {
  const user = auth.currentUser;
  const { theme, setTheme } = useStore();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      alert(`Failed to log out: ${(err as Error).message}`);
    }
  };
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="User Profile" />
        <CardContent className="p-6 text-center space-y-4 bg-white dark:bg-slate-900">
          {user?.photoURL ? (
            <img 
              src={user.photoURL} 
              alt={user.displayName || "User"} 
              className="mx-auto w-20 h-20 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="mx-auto w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <User className="w-10 h-10 text-slate-400 dark:text-slate-500" />
            </div>
          )}
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {user?.displayName || (user?.isAnonymous ? "Local Workstation User" : "Anonymous User")}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {user?.email || (user?.isAnonymous ? "Local Emulator Session" : "No email linked")}
            </p>
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-4">
              {user?.isAnonymous 
                ? "Running in local mode. Authentication and Google Login are bypassed."
                : "Authenticated securely via Google Login."}
            </p>
            <button 
              onClick={handleLogout}
              className="flex items-center space-x-2 py-2 px-6 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold text-sm transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Theme Preference" />
        <CardContent className="p-4 space-y-3 bg-white dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select your preferred visual mode for Harbour Finance. System settings will apply by default.
          </p>
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 cursor-pointer ${
                theme === 'light' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-amber-500 stroke-[2.25]' : 'stroke-[1.75]'}`} />
              <span>Light Mode</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-slate-800 dark:bg-slate-800 text-white shadow-sm border border-slate-700/50 dark:border-slate-700/50' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-blue-400 stroke-[2.25]' : 'stroke-[1.75]'}`} />
              <span>Dark Mode</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const AboutSection = () => {
  return (
    <Card>
      <CardHeader title="App Info" />
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Harbour Finance</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Version 1.0.0-prototype</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          A mobile-first Progressive Web App for tracking non-U.S. Caribbean equity holdings. Features offline-capable data tracking for portfolio construction in Guyana, Jamaica, Trinidad & Tobago, Barbados, and OECS markets.
        </p>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded text-xs text-slate-500 dark:text-slate-400">
          Built as a prototype demonstration. All data is stored locally in your browser schema.
        </div>
      </CardContent>
    </Card>
  );
};

const PriceUpdatesTab = () => {
  const { securities, addPriceUpdate, exchanges } = useStore();
  const [secId, setSecId] = useState(securities[0]?.id || '');
  const [price, setPrice] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Modal alert states
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const selectedSec = securities.find(s => s.id === secId);
  const currency = selectedSec ? (selectedSec.currency || exchanges.find(e => e.id === selectedSec.exchangeId)?.currency || 'USD') : 'USD';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSec) return;
    try {
      await addPriceUpdate({
        securityId: secId,
        date,
        price: Number(price),
        currency: currency as any,
        source: 'Manual'
      });
      setAlertMsg(`Price record for ${selectedSec.ticker} has been updated to ${currency} ${Number(price).toFixed(2)}.`);
      setAlertOpen(true);
    } catch (err) {
      setAlertMsg(`Failed to update price: ${(err as Error).message}`);
      setAlertOpen(true);
    }
  };

  return (
    <>
      <Card>
        <CardHeader title="Manually Update Price" />
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Security</label>
              <select value={secId} onChange={e => setSecId(e.target.value)} className="w-full text-sm border border-slate-300 dark:border-slate-800 rounded p-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {securities.map(s => <option key={s.id} value={s.id}>{s.ticker} - {s.companyName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Price</label>
                <input type="number" step="0.01" required value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full text-sm border border-slate-300 dark:border-slate-800 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
              </div>
              <div>
                 <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Date</label>
                 <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full text-sm border border-slate-300 dark:border-slate-800 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
              </div>
            </div>
            <button type="submit" className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold flex justify-center items-center transition-colors cursor-pointer">
              <PlusCircle className="w-4 h-4 mr-2" /> Add Price Record
            </button>
          </form>
        </CardContent>
      </Card>
      
      <AlertDialog
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="Price Updated"
        message={alertMsg}
        type="success"
      />
    </>
  );
};

const FXUpdatesTab = () => {
  const { addFXRate } = useStore();
  const [toCurrency, setToCurrency] = useState<Currency>('GYD');
  const [rate, setRate] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Modal alert states
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addFXRate({
        fromCurrency: 'USD',
        toCurrency,
        date,
        rate: Number(rate),
        source: 'Manual'
      });
      setAlertMsg(`FX Conversion rate for ${toCurrency} has been updated to ${Number(rate).toFixed(4)}.`);
      setAlertOpen(true);
    } catch (err) {
      setAlertMsg(`Failed to update FX rate: ${(err as Error).message}`);
      setAlertOpen(true);
    }
  };

  return (
    <>
      <Card>
        <CardHeader title="Update FX Rate (vs USD)" />
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 p-2 bg-slate-50 dark:bg-slate-950 rounded border border-transparent dark:border-slate-800">
              Enter how much 1 USD is worth in the local currency. e.g. 1 USD = 208 GYD.
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Target Currency</label>
              <select value={toCurrency} onChange={e => setToCurrency(e.target.value as Currency)} className="w-full text-sm border border-slate-300 dark:border-slate-800 rounded p-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="GYD">GYD</option>
                <option value="JMD">JMD</option>
                <option value="TTD">TTD</option>
                <option value="BBD">BBD</option>
                <option value="XCD">XCD</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Rate</label>
                <input type="number" step="0.001" required value={rate} onChange={e => setRate(Number(e.target.value))} className="w-full text-sm border border-slate-300 dark:border-slate-800 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
              </div>
              <div>
                 <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Date</label>
                 <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full text-sm border border-slate-300 dark:border-slate-800 rounded p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" />
              </div>
            </div>
            <button type="submit" className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold flex justify-center items-center transition-colors cursor-pointer">
              <PlusCircle className="w-4 h-4 mr-2" /> Add FX Record
            </button>
          </form>
        </CardContent>
      </Card>
      
      <AlertDialog
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="FX Rate Updated"
        message={alertMsg}
        type="success"
      />
    </>
  );
};
