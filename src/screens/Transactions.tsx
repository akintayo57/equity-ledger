import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Card, CardContent } from '../components/ui/Cards';
import { formatMoney } from '../utils';
import { format } from 'date-fns';
import { PlusCircle, Edit2, Trash2, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { Transaction, TransactionType, Currency } from '../types';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useLocation } from 'react-router-dom';

export const Transactions = () => {
  const { transactions, securities, deleteTransaction } = useStore();
  const location = useLocation();
  const locationState = location.state as { showAdd?: boolean; securityId?: string } | null;
  
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<string | null>(null);

  // Widget view state: defaults to collapsed unless redirected with payload
  const [showFullLayout, setShowFullLayout] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Automatically open full layout if redirecting with transaction instructions
  useEffect(() => {
    if (locationState?.showAdd || locationState?.securityId) {
      setShowFullLayout(true);
      setShowAdd(!!locationState?.showAdd);
    }
  }, [locationState]);

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

  // Render widget preview if not selected/expanded
  if (!showFullLayout) {
    return (
      <div className="py-2">
        <div onClick={() => setShowFullLayout(true)} className="cursor-pointer">
          <Card className="bg-slate-50 border border-slate-200/70 shadow-xs hover:shadow-md hover:border-slate-350 transition-all duration-300">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl shadow-xs">
                <ArrowLeftRight className="w-8 h-8 text-blue-600 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">Transaction Ledger Widget</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
                  Manage buys, sales, splits, and dividend records. Contains {transactions.length} total entries.
                </p>
              </div>
              <button className="text-xs font-bold text-white bg-blue-600 px-5 py-2.5 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/10 active:scale-98 transition-all shrink-0 cursor-pointer">
                Open Ledger History
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center space-x-2.5">
          <h2 className="text-base font-bold text-slate-800">Ledger History</h2>
          <button 
            onClick={() => {
              setShowFullLayout(false);
              setShowAdd(false);
              setEditingTxId(null);
            }}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded border border-slate-200 bg-slate-100/50 hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            Collapse Widget
          </button>
        </div>
        <button 
          onClick={() => {
            setShowAdd(!showAdd);
            setEditingTxId(null);
          }}
          className="flex items-center space-x-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-semibold shadow-md shadow-blue-500/10 transition-all hover:scale-102 active:scale-98 cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add Record</span>
        </button>
      </div>

      {(showAdd || editingTxId) && (
        <TransactionForm 
          initialTx={transactions.find(tx => tx.id === editingTxId)}
          preSelectedSecurityId={locationState?.securityId}
          onClose={() => {
            setShowAdd(false);
            setEditingTxId(null);
            // Clear location state if any
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
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        tx.type === 'BUY' 
                          ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/10' 
                          : tx.type === 'SELL' 
                          ? 'bg-rose-500/15 text-rose-600 border border-rose-500/10' 
                          : tx.type === 'INHERIT'
                          ? 'bg-amber-500/15 text-amber-600 border border-amber-500/10'
                          : 'bg-slate-500/15 text-slate-600 border border-slate-500/10'
                      }`}>
                        {tx.type}
                      </span>
                      <span className="font-bold text-slate-800">{sec.ticker}</span>
                      {tx.isUncertain && (
                        <span className="flex items-center space-x-0.5 text-[9px] font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md" title="Cost basis estimated.">
                          <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                          Uncertain
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{format(new Date(tx.date), 'MMM d, yyyy')}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-800">{tx.shares} shs</div>
                    <div className="text-xs text-slate-500">
                      {tx.type === 'INHERIT' ? 'Inherited / Unknown' : `@ ${formatMoney(tx.pricePerShare, tx.currency)}`}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                  <button onClick={() => handleEdit(tx.id)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-colors cursor-pointer">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeletePrompt(tx.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg transition-colors cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {sortedTxs.length === 0 && <div className="text-center text-slate-500 py-8 text-sm">No transactions found.</div>}
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
  const { securities, accounts, addTransaction, updateTransaction, addAccount, exchanges } = useStore();
  
  const [type, setType] = useState<TransactionType>(initialTx?.type || 'BUY');
  const [secId, setSecId] = useState(initialTx?.securityId || preSelectedSecurityId || securities[0]?.id || '');
  const [accId, setAccId] = useState(initialTx?.accountId || accounts[0]?.id || '');
  const [date, setDate] = useState(initialTx?.date || new Date().toISOString().split('T')[0]);
  const [shares, setShares] = useState(initialTx?.shares || 100);
  const [price, setPrice] = useState(initialTx?.pricePerShare || 0);
  const [fees, setFees] = useState(initialTx?.fees || 0);
  const [isUncertain, setIsUncertain] = useState(initialTx?.isUncertain || false);

  // Modals visibility
  const [showAddAcc, setShowAddAcc] = useState(false);

  // States for a new broker account
  const [newAccName, setNewAccName] = useState('');
  const [newAccCountry, setNewAccCountry] = useState('Guyana');
  const [newAccCurrency, setNewAccCurrency] = useState<Currency>('GYD');

  const selectedSec = securities.find(s => s.id === secId);
  const currency = selectedSec ? (selectedSec.currency || exchanges.find(e => e.id === selectedSec.exchangeId)?.currency || 'USD') : 'USD';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSec) return;
    
    const txData = {
      type,
      securityId: secId,
      accountId: accId,
      date,
      shares: Number(shares),
      pricePerShare: (type === 'INHERIT' || type === 'SPLIT') ? 0 : Number(price),
      currency: currency as any,
      fees: (type === 'INHERIT' || type === 'SPLIT') ? 0 : Number(fees),
      isUncertain: type === 'INHERIT' ? true : isUncertain,
    };

    if (initialTx) {
      updateTransaction(initialTx.id, txData);
    } else {
      addTransaction(txData);
    }
    
    onClose();
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
    setNewAccName('');
  };

  const isNoCashFlow = type === 'INHERIT' || type === 'SPLIT';

  return (
    <>
      <Card className="bg-slate-50 border border-blue-200 shadow-inner mb-6">
        <CardContent className="p-4">
          <h3 className="font-bold text-slate-800 mb-3 text-sm">{initialTx ? 'Edit Transaction' : 'New Transaction'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select 
                  value={type} 
                  onChange={e => {
                    const newType = e.target.value as TransactionType;
                    setType(newType);
                    if (newType === 'INHERIT' || newType === 'SPLIT') {
                      setIsUncertain(newType === 'INHERIT');
                      setPrice(0);
                      setFees(0);
                    }
                  }} 
                  className="w-full text-sm border border-slate-350 rounded p-1.5 focus:ring-blue-500 bg-white"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                  <option value="DIVIDEND">DIVIDEND</option>
                  <option value="INHERIT">INHERIT (No purchase info)</option>
                  <option value="SPLIT">SPLIT (Stock Split)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full text-sm border border-slate-350 rounded p-1.5 focus:ring-blue-500 bg-white" />
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-slate-500 mb-1">Security / Stock</label>
              <select value={secId} onChange={e => setSecId(e.target.value)} className="w-full text-sm border border-slate-350 rounded p-1.5 focus:ring-blue-500 bg-white">
                {securities.map(s => <option key={s.id} value={s.id}>{s.ticker} - {s.companyName}</option>)}
              </select>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-slate-500">Account / Broker</label>
                <button 
                  type="button" 
                  onClick={() => setShowAddAcc(true)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  + Add New Broker
                </button>
              </div>
              <select value={accId} onChange={e => setAccId(e.target.value)} className="w-full text-sm border border-slate-350 rounded p-1.5 focus:ring-blue-500 bg-white">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.brokerName}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  {type === 'SPLIT' ? 'Split Ratio (e.g. 2 for 2-for-1)' : 'Shares'}
                </label>
                <input type="number" required min="0.001" step="0.001" value={shares} onChange={e => setShares(Number(e.target.value))} className="w-full text-sm border border-slate-350 rounded p-1.5 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Price per share ({currency})</label>
                <input 
                  type="number" 
                  required 
                  min="0" 
                  step="0.01" 
                  disabled={isNoCashFlow}
                  value={isNoCashFlow ? 0 : price} 
                  onChange={e => setPrice(Number(e.target.value))} 
                  className="w-full text-sm border border-slate-350 rounded p-1.5 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-400" 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Fees ({currency})</label>
              <input 
                type="number" 
                min="0" 
                step="0.01" 
                disabled={isNoCashFlow}
                value={isNoCashFlow ? 0 : fees} 
                onChange={e => setFees(Number(e.target.value))} 
                className="w-full text-sm border border-slate-350 rounded p-1.5 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-400" 
              />
            </div>
            
            <div className="flex items-center space-x-2 py-1">
              <input 
                type="checkbox" 
                id="isUncertain" 
                checked={isUncertain || type === 'INHERIT'} 
                disabled={isNoCashFlow}
                onChange={e => setIsUncertain(e.target.checked)} 
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 bg-white cursor-pointer" 
              />
              <label htmlFor="isUncertain" className="text-xs text-slate-600 select-none cursor-pointer">
                Flag transaction as uncertain (e.g. predates exchange, estimated cost basis)
              </label>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded cursor-pointer">Cancel</button>
              <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold transition-colors cursor-pointer">Save</button>
            </div>
          </form>
        </CardContent>
      </Card>

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
            <button type="button" onClick={() => setShowAddAcc(false)} className="px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 rounded cursor-pointer">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold transition-colors cursor-pointer">Add Broker</button>
          </div>
        </form>
      </Modal>
    </>
  );
};
