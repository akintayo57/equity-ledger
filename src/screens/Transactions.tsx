import React, { useState } from 'react';
import { useStore } from '../store';
import { Card, CardContent } from '../components/ui/Cards';
import { formatMoney } from '../utils';
import { format } from 'date-fns';
import { PlusCircle, Edit2, Trash2 } from 'lucide-react';
import { Transaction, TransactionType, Currency } from '../types';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useLocation } from 'react-router-dom';

export const Transactions = () => {
  const { transactions, securities, deleteTransaction } = useStore();
  const location = useLocation();
  const locationState = location.state as { showAdd?: boolean; securityId?: string } | null;
  const [showAdd, setShowAdd] = useState(locationState?.showAdd || false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<string | null>(null);

  const sortedTxs = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleEdit = (id: string) => {
    setEditingTxId(id);
    setShowAdd(false);
  };

  const handleDeletePrompt = (id: string) => {
    setTxToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (txToDelete) {
      deleteTransaction(txToDelete);
      setTxToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold border-b-2 border-transparent">History</h2>
        <button 
          onClick={() => {
            setShowAdd(!showAdd);
            setEditingTxId(null);
          }}
          className="flex items-center space-x-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-semibold shadow-md shadow-blue-500/10 transition-all hover:scale-102 active:scale-98"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add</span>
        </button>
      </div>

      {(showAdd || editingTxId) && (
        <TransactionForm 
          initialTx={transactions.find(tx => tx.id === editingTxId)}
          preSelectedSecurityId={locationState?.securityId}
          onClose={() => {
            setShowAdd(false);
            setEditingTxId(null);
            window.history.replaceState({}, document.title);
          }} 
        />
      )}

      <div className="space-y-3">
        {sortedTxs.map(tx => {
          const sec = securities.find(s => s.id === tx.securityId);
          if (!sec) return null;
          return (
            <Card key={tx.id}>
              <CardContent className="p-4 flex flex-col space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${tx.type === 'BUY' ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/10' : tx.type === 'SELL' ? 'bg-rose-500/15 text-rose-600 border border-rose-500/10' : 'bg-slate-500/15 text-slate-600 border border-slate-500/10'}`}>
                        {tx.type}
                      </span>
                      <span className="font-bold text-slate-800">{sec.ticker}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{format(new Date(tx.date), 'MMM d, yyyy')}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-800">{tx.shares} shs</div>
                    <div className="text-xs text-slate-500">@ {formatMoney(tx.pricePerShare, tx.currency)}</div>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button onClick={() => handleEdit(tx.id)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeletePrompt(tx.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {sortedTxs.length === 0 && <div className="text-center text-slate-500 py-8">No transactions found.</div>}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setTxToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Transaction"
        message="Are you sure you want to permanently delete this transaction? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
};

const TransactionForm = ({ onClose, initialTx, preSelectedSecurityId }: { onClose: () => void, initialTx?: Transaction, preSelectedSecurityId?: string }) => {
  const { securities, accounts, addTransaction, updateTransaction, addSecurity, addPriceUpdate, addAccount } = useStore();
  
  const [type, setType] = useState<TransactionType>(initialTx?.type || 'BUY');
  const [secId, setSecId] = useState(initialTx?.securityId || preSelectedSecurityId || securities[0]?.id || '');
  const [accId, setAccId] = useState(initialTx?.accountId || accounts[0]?.id || '');
  const [date, setDate] = useState(initialTx?.date || new Date().toISOString().split('T')[0]);
  const [shares, setShares] = useState(initialTx?.shares || 100);
  const [price, setPrice] = useState(initialTx?.pricePerShare || 0);
  const [fees, setFees] = useState(initialTx?.fees || 0);

  // Modals visibility
  const [showAddSec, setShowAddSec] = useState(false);
  const [showAddAcc, setShowAddAcc] = useState(false);

  // States for a new security
  const [newSecTicker, setNewSecTicker] = useState('');
  const [newSecName, setNewSecName] = useState('');
  const [newSecExchange, setNewSecExchange] = useState('GASCI');
  const [newSecCountry, setNewSecCountry] = useState('Guyana');
  const [newSecCurrency, setNewSecCurrency] = useState<Currency>('GYD');
  const [newSecSector, setNewSecSector] = useState('Financials');
  const [newSecPrice, setNewSecPrice] = useState(1);

  // States for a new broker account
  const [newAccName, setNewAccName] = useState('');
  const [newAccCountry, setNewAccCountry] = useState('Guyana');
  const [newAccCurrency, setNewAccCurrency] = useState<Currency>('GYD');

  const selectedSec = securities.find(s => s.id === secId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSec) return;
    
    const txData = {
      type,
      securityId: secId,
      accountId: accId,
      date,
      shares: Number(shares),
      pricePerShare: Number(price),
      currency: selectedSec.currency,
      fees: Number(fees),
    };

    if (initialTx) {
      updateTransaction(initialTx.id, txData);
    } else {
      addTransaction(txData);
    }
    
    onClose();
  };

  const handleAddSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecTicker || !newSecName) return;

    const newId = await addSecurity({
      companyName: newSecName,
      ticker: newSecTicker.trim().toUpperCase(),
      exchange: newSecExchange,
      country: newSecCountry,
      currency: newSecCurrency,
      sector: newSecSector,
      status: 'ACTIVE'
    });

    if (newSecPrice > 0) {
      await addPriceUpdate({
        securityId: newId,
        date: new Date().toISOString().split('T')[0],
        price: Number(newSecPrice),
        currency: newSecCurrency,
        source: 'Initial Setup'
      });
    }

    setSecId(newId);
    setShowAddSec(false);
    
    // Reset inputs
    setNewSecTicker('');
    setNewSecName('');
    setNewSecPrice(1);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName) return;

    const newId = await addAccount({
      brokerName: newAccName,
      country: newAccCountry,
      baseCurrency: newAccCurrency
    });

    setAccId(newId);
    setShowAddAcc(false);

    // Reset inputs
    setNewAccName('');
  };

  return (
    <>
      <Card className="bg-slate-50 border-blue-200 shadow-inner mb-6">
        <CardContent className="p-4">
          <h3 className="font-bold text-slate-800 mb-3 text-sm">{initialTx ? 'Edit Transaction' : 'New Transaction'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select value={type} onChange={e => setType(e.target.value as TransactionType)} className="w-full text-sm border-slate-300 rounded p-1.5 focus:ring-blue-500 bg-white">
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                  <option value="DIVIDEND">DIVIDEND</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full text-sm border border-slate-300 rounded p-1.5 focus:ring-blue-500 bg-white" />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-slate-500">Security / Stock</label>
                <button 
                  type="button" 
                  onClick={() => setShowAddSec(true)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold"
                >
                  + Add New Stock
                </button>
              </div>
              <select value={secId} onChange={e => setSecId(e.target.value)} className="w-full text-sm border border-slate-300 rounded p-1.5 focus:ring-blue-500 bg-white">
                {securities.map(s => <option key={s.id} value={s.id}>{s.ticker} - {s.companyName}</option>)}
              </select>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-slate-500">Account / Broker</label>
                <button 
                  type="button" 
                  onClick={() => setShowAddAcc(true)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold"
                >
                  + Add New Broker
                </button>
              </div>
              <select value={accId} onChange={e => setAccId(e.target.value)} className="w-full text-sm border border-slate-300 rounded p-1.5 focus:ring-blue-500 bg-white">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.brokerName}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Shares</label>
                <input type="number" required min="1" step="0.001" value={shares} onChange={e => setShares(Number(e.target.value))} className="w-full text-sm border border-slate-300 rounded p-1.5 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Price per share ({selectedSec?.currency})</label>
                <input type="number" required min="0" step="0.01" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full text-sm border border-slate-300 rounded p-1.5 focus:ring-blue-500 bg-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Fees ({selectedSec?.currency})</label>
              <input type="number" min="0" step="0.01" value={fees} onChange={e => setFees(Number(e.target.value))} className="w-full text-sm border border-slate-300 rounded p-1.5 focus:ring-blue-500 bg-white" />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
              <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold transition-colors">Save</button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Modal to add a new Security */}
      <Modal isOpen={showAddSec} onClose={() => setShowAddSec(false)} title="Create Custom Security / Stock">
        <form onSubmit={handleAddSecurity} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ticker Symbol</label>
              <input type="text" required placeholder="e.g. DBL" value={newSecTicker} onChange={e => setNewSecTicker(e.target.value)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Exchange</label>
              <select value={newSecExchange} onChange={e => setNewSecExchange(e.target.value)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-blue-500 focus:outline-none">
                <option value="GASCI">GASCI (Guyana)</option>
                <option value="JSE">JSE (Jamaica)</option>
                <option value="TTSE">TTSE (Trinidad)</option>
                <option value="BSE">BSE (Barbados)</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Company Name</label>
            <input type="text" required placeholder="e.g. Demerara Bank Limited" value={newSecName} onChange={e => setNewSecName(e.target.value)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Country</label>
              <select value={newSecCountry} onChange={e => setNewSecCountry(e.target.value)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-blue-500 focus:outline-none">
                <option value="Guyana">Guyana</option>
                <option value="Jamaica">Jamaica</option>
                <option value="Trinidad & Tobago">Trinidad & Tobago</option>
                <option value="Barbados">Barbados</option>
                <option value="OECS">OECS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Local Currency</label>
              <select value={newSecCurrency} onChange={e => setNewSecCurrency(e.target.value as Currency)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-blue-500 focus:outline-none">
                <option value="GYD">GYD</option>
                <option value="JMD">JMD</option>
                <option value="TTD">TTD</option>
                <option value="BBD">BBD</option>
                <option value="XCD">XCD</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sector</label>
              <select value={newSecSector} onChange={e => setNewSecSector(e.target.value)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-blue-500 focus:outline-none">
                <option value="Financials">Financials</option>
                <option value="Consumer Staples">Consumer Staples</option>
                <option value="Industrials">Industrials</option>
                <option value="Utilities">Utilities</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Conglomerate">Conglomerate</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Initial Price</label>
              <input type="number" step="0.01" required value={newSecPrice} onChange={e => setNewSecPrice(Number(e.target.value))} className="w-full text-sm bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800 mt-2">
            <button type="button" onClick={() => setShowAddSec(false)} className="px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 rounded">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold transition-colors">Add Stock</button>
          </div>
        </form>
      </Modal>

      {/* Modal to add a new Account */}
      <Modal isOpen={showAddAcc} onClose={() => setShowAddAcc(false)} title="Create Broker / Portfolio Account">
        <form onSubmit={handleAddAccount} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Broker Name</label>
            <input type="text" required placeholder="e.g. Guyana Americas Merchant Bank" value={newAccName} onChange={e => setNewAccName(e.target.value)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Country</label>
              <input type="text" required placeholder="e.g. Guyana" value={newAccCountry} onChange={e => setNewAccCountry(e.target.value)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Base Currency</label>
              <select value={newAccCurrency} onChange={e => setNewAccCurrency(e.target.value as Currency)} className="w-full text-sm bg-slate-800 border border-slate-700 rounded p-1.5 text-slate-100 focus:ring-blue-500 focus:outline-none">
                <option value="GYD">GYD</option>
                <option value="JMD">JMD</option>
                <option value="TTD">TTD</option>
                <option value="BBD">BBD</option>
                <option value="XCD">XCD</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800 mt-2">
            <button type="button" onClick={() => setShowAddAcc(false)} className="px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 rounded">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold transition-colors">Add Broker</button>
          </div>
        </form>
      </Modal>
    </>
  );
};
