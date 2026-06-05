import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Security, Account, Transaction, PriceUpdate, FXRate, HoldingCalculation, PortfolioSummary, Exchange, EquityNote } from './types';
import { calculateHoldings } from './utils';
import { User } from 'firebase/auth';
import { 
  db,
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc 
} from './firebase';

interface AppState {
  securities: Security[];
  accounts: Account[];
  transactions: Transaction[];
  prices: PriceUpdate[];
  fxRates: FXRate[];
  exchanges: Exchange[];
  equityNotes: EquityNote[];
  watchlist: string[];
  loading: boolean;
}

interface StoreContextType extends AppState {
  holdings: HoldingCalculation[];
  portfolioSummary: PortfolioSummary;
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void>;
  updateTransaction: (id: string, tx: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addPriceUpdate: (px: Omit<PriceUpdate, 'id'>) => Promise<void>;
  addFXRate: (fx: Omit<FXRate, 'id'>) => Promise<void>;
  addSecurity: (sec: Omit<Security, 'id'>) => Promise<string>;
  updateSecurity: (id: string, sec: Partial<Security>) => Promise<void>;
  toggleWatchlist: (id: string) => Promise<void>;
  addAccount: (acc: Omit<Account, 'id'>) => Promise<string>;
  addEquityNote: (note: Omit<EquityNote, 'id'>) => Promise<void>;
  deleteEquityNote: (id: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider = ({ children, user }: { children: ReactNode; user: User }) => {
  const [securities, setSecurities] = useState<Security[]>([]);
  const [prices, setPrices] = useState<PriceUpdate[]>([]);
  const [fxRates, setFXRates] = useState<FXRate[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [equityNotes, setEquityNotes] = useState<EquityNote[]>([]);
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Cache user profile metadata to ensure consistent offline path matching
  useEffect(() => {
    const isOffline = localStorage.getItem('harbour_auth_mode') === 'offline';
    if (user && !isOffline) {
      const offlineUserData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        isAnonymous: user.isAnonymous,
        photoURL: user.photoURL
      };
      localStorage.setItem('harbour_offline_user', JSON.stringify(offlineUserData));
    }
  }, [user]);

  // Sync Global Collections (Securities, Prices, FX Rates, Exchanges, Notes)
  useEffect(() => {
    // 1. Sync Exchanges
    const unsubExchanges = onSnapshot(collection(db, 'exchanges'), (snap) => {
      const exs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Exchange));
      setExchanges(exs);
      if (localStorage.getItem('harbour_auth_mode') !== 'offline') {
        localStorage.setItem('harbour_data_exchanges', JSON.stringify(exs));
      }
    });

    // 2. Sync Securities
    const unsubSecurities = onSnapshot(collection(db, 'securities'), (snap) => {
      const secs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Security));
      setSecurities(secs);
      if (localStorage.getItem('harbour_auth_mode') !== 'offline') {
        localStorage.setItem('harbour_data_securities', JSON.stringify(secs));
      }
    });

    // 3. Sync Prices
    const unsubPrices = onSnapshot(collection(db, 'prices'), (snap) => {
      const pxs = snap.docs.map(d => ({ ...d.data(), id: d.id } as PriceUpdate));
      setPrices(pxs);
      if (localStorage.getItem('harbour_auth_mode') !== 'offline') {
        localStorage.setItem('harbour_data_prices', JSON.stringify(pxs));
      }
    });

    // 4. Sync FX Rates
    const unsubFX = onSnapshot(collection(db, 'fxRates'), (snap) => {
      const fxs = snap.docs.map(d => ({ ...d.data(), id: d.id } as FXRate));
      setFXRates(fxs);
      if (localStorage.getItem('harbour_auth_mode') !== 'offline') {
        localStorage.setItem('harbour_data_fxRates', JSON.stringify(fxs));
      }
    });

    // 5. Sync Equity Notes
    const unsubNotes = onSnapshot(collection(db, 'equityNotes'), (snap) => {
      const nts = snap.docs.map(d => ({ ...d.data(), id: d.id } as EquityNote));
      setEquityNotes(nts);
      if (localStorage.getItem('harbour_auth_mode') !== 'offline') {
        localStorage.setItem('harbour_data_equityNotes', JSON.stringify(nts));
      }
    });

    return () => {
      unsubExchanges();
      unsubSecurities();
      unsubPrices();
      unsubFX();
      unsubNotes();
    };
  }, []);

  // Sync User Specific Subcollections
  useEffect(() => {
    setLoading(true);
    
    // Sync User Accounts
    const unsubAccounts = onSnapshot(collection(db, 'users', user.uid, 'accounts'), (snap) => {
      const accs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Account));
      setAccounts(accs);
      if (localStorage.getItem('harbour_auth_mode') !== 'offline') {
        localStorage.setItem(`harbour_data_users_${user.uid}_accounts`, JSON.stringify(accs));
      }
    });

    // Sync User Transactions
    const unsubTransactions = onSnapshot(collection(db, 'users', user.uid, 'transactions'), (snap) => {
      const txs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction));
      setTransactions(txs);
      if (localStorage.getItem('harbour_auth_mode') !== 'offline') {
        localStorage.setItem(`harbour_data_users_${user.uid}_transactions`, JSON.stringify(txs));
      }
    });

    // Sync User Watchlist
    const unsubWatchlist = onSnapshot(doc(db, 'users', user.uid, 'watchlist', 'default'), (docSnap) => {
      const securityIds = docSnap.exists() ? (docSnap.data().securityIds || []) : [];
      setWatchlist(securityIds);
      if (localStorage.getItem('harbour_auth_mode') !== 'offline') {
        localStorage.setItem(`harbour_data_users_${user.uid}_watchlist_default`, JSON.stringify({ securityIds }));
      }
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => {
      unsubAccounts();
      unsubTransactions();
      unsubWatchlist();
    };
  }, [user.uid]);

  const holdings = useMemo(() => {
    return calculateHoldings(securities, transactions, prices, fxRates, exchanges);
  }, [securities, transactions, prices, fxRates, exchanges]);

  const portfolioSummary = useMemo(() => {
    const summary: PortfolioSummary = holdings.reduce(
      (acc, curr) => {
        acc.totalMarketValueUSD += curr.marketValueUSD;
        acc.totalCostBasisUSD += curr.totalCostBasisUSD;
        acc.unrealizedGainUSD += curr.unrealizedGainUSD;
        acc.totalDividendsUSD += curr.totalDividendsUSD;
        return acc;
      },
      { totalMarketValueUSD: 0, totalCostBasisUSD: 0, unrealizedGainUSD: 0, capitalGrowthPct: 0, totalDividendsUSD: 0 }
    );

    if (summary.totalCostBasisUSD > 0) {
      summary.capitalGrowthPct = (summary.unrealizedGainUSD / summary.totalCostBasisUSD) * 100;
    }

    return summary;
  }, [holdings]);

  // Database mutations
  const addTransaction = async (tx: Omit<Transaction, 'id'>) => {
    await addDoc(collection(db, 'users', user.uid, 'transactions'), tx);
  };

  const updateTransaction = async (id: string, updatedTx: Omit<Transaction, 'id'>) => {
    await setDoc(doc(db, 'users', user.uid, 'transactions', id), updatedTx);
  };

  const deleteTransaction = async (id: string) => {
    await deleteDoc(doc(db, 'users', user.uid, 'transactions', id));
  };

  const addPriceUpdate = async (px: Omit<PriceUpdate, 'id'>) => {
    await addDoc(collection(db, 'prices'), px);
  };

  const addFXRate = async (fx: Omit<FXRate, 'id'>) => {
    await addDoc(collection(db, 'fxRates'), fx);
  };

  const addSecurity = async (sec: Omit<Security, 'id'>) => {
    const docRef = await addDoc(collection(db, 'securities'), sec);
    return docRef.id;
  };

  const addAccount = async (acc: Omit<Account, 'id'>) => {
    const docRef = await addDoc(collection(db, 'users', user.uid, 'accounts'), acc);
    return docRef.id;
  };

  const updateSecurity = async (id: string, sec: Partial<Security>) => {
    await updateDoc(doc(db, 'securities', id), sec);
  };

  const toggleWatchlist = async (id: string) => {
    const isWatched = watchlist.includes(id);
    const updatedWatchlist = isWatched ? watchlist.filter(w => w !== id) : [...watchlist, id];
    await setDoc(doc(db, 'users', user.uid, 'watchlist', 'default'), {
      securityIds: updatedWatchlist
    });
  };

  const addEquityNote = async (note: Omit<EquityNote, 'id'>) => {
    await addDoc(collection(db, 'equityNotes'), note);
  };

  const deleteEquityNote = async (id: string) => {
    await deleteDoc(doc(db, 'equityNotes', id));
  };

  return (
    <StoreContext.Provider
      value={{
        securities,
        accounts,
        transactions,
        prices,
        fxRates,
        exchanges,
        equityNotes,
        watchlist,
        loading,
        holdings,
        portfolioSummary,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addPriceUpdate,
        addFXRate,
        addSecurity,
        updateSecurity,
        toggleWatchlist,
        addAccount,
        addEquityNote,
        deleteEquityNote,
      }}
    >
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-xs font-semibold animate-pulse">Syncing database...</p>
          </div>
        </div>
      ) : children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};

