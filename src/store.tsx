import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Security, Account, Transaction, PriceUpdate, FXRate, HoldingCalculation, PortfolioSummary } from './types';
import { initialSecurities, initialAccounts, initialTransactions, initialPrices, initialFXRates, initialWatchlist } from './mockData';
import { calculateHoldings } from './utils';

// Generate UUIDs simply
const generateId = () => Math.random().toString(36).substring(2, 9);

interface AppState {
  securities: Security[];
  accounts: Account[];
  transactions: Transaction[];
  prices: PriceUpdate[];
  fxRates: FXRate[];
  watchlist: string[];
}

interface StoreContextType extends AppState {
  holdings: HoldingCalculation[];
  portfolioSummary: PortfolioSummary;
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, tx: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  addPriceUpdate: (px: Omit<PriceUpdate, 'id'>) => void;
  addFXRate: (fx: Omit<FXRate, 'id'>) => void;
  addSecurity: (sec: Omit<Security, 'id'>) => string;
  updateSecurity: (id: string, sec: Partial<Security>) => void;
  toggleWatchlist: (id: string) => void;
  addAccount: (acc: Omit<Account, 'id'>) => string;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEY = 'harbour_finance_state_v1';

const loadState = (): AppState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        securities: parsed.securities || initialSecurities,
        accounts: parsed.accounts || initialAccounts,
        transactions: parsed.transactions || [],
        prices: parsed.prices || initialPrices,
        fxRates: parsed.fxRates || initialFXRates,
        watchlist: parsed.watchlist || [],
      };
    } catch {
      // Return defaults on error
    }
  }
  return {
    securities: initialSecurities,
    accounts: initialAccounts,
    transactions: [],
    prices: initialPrices,
    fxRates: initialFXRates,
    watchlist: [],
  };
};

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>(loadState());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const holdings = calculateHoldings(state.securities, state.transactions, state.prices, state.fxRates);

  const portfolioSummary: PortfolioSummary = holdings.reduce(
    (acc, curr) => {
      acc.totalMarketValueUSD += curr.marketValueUSD;
      acc.totalCostBasisUSD += curr.totalCostBasisUSD;
      acc.unrealizedGainUSD += curr.unrealizedGainUSD;
      return acc;
    },
    { totalMarketValueUSD: 0, totalCostBasisUSD: 0, unrealizedGainUSD: 0, capitalGrowthPct: 0 }
  );

  if (portfolioSummary.totalCostBasisUSD > 0) {
    portfolioSummary.capitalGrowthPct = (portfolioSummary.unrealizedGainUSD / portfolioSummary.totalCostBasisUSD) * 100;
  }

  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    setState((prev) => ({
      ...prev,
      transactions: [...prev.transactions, { ...tx, id: `tx-${generateId()}` }],
    }));
  };

  const updateTransaction = (id: string, updatedTx: Omit<Transaction, 'id'>) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((tx) => (tx.id === id ? { ...updatedTx, id } : tx)),
    }));
  };

  const deleteTransaction = (id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((tx) => tx.id !== id),
    }));
  };

  const addPriceUpdate = (px: Omit<PriceUpdate, 'id'>) => {
    setState((prev) => ({
      ...prev,
      prices: [...prev.prices, { ...px, id: `px-${generateId()}` }],
    }));
  };

  const addFXRate = (fx: Omit<FXRate, 'id'>) => {
    setState((prev) => ({
      ...prev,
      fxRates: [...prev.fxRates, { ...fx, id: `fx-${generateId()}` }],
    }));
  };

  const addSecurity = (sec: Omit<Security, 'id'>) => {
    const id = `sec-${generateId()}`;
    setState((prev) => ({
      ...prev,
      securities: [...prev.securities, { ...sec, id }],
    }));
    return id;
  };

  const addAccount = (acc: Omit<Account, 'id'>) => {
    const id = `acc-${generateId()}`;
    setState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, { ...acc, id }],
    }));
    return id;
  };

  const updateSecurity = (id: string, sec: Partial<Security>) => {
    setState((prev) => ({
      ...prev,
      securities: prev.securities.map((s) => (s.id === id ? { ...s, ...sec } : s)),
    }));
  };

  const toggleWatchlist = (id: string) => {
    setState((prev) => {
      const isWatched = prev.watchlist.includes(id);
      return {
        ...prev,
        watchlist: isWatched ? prev.watchlist.filter(w => w !== id) : [...prev.watchlist, id]
      };
    });
  };

  return (
    <StoreContext.Provider
      value={{
        ...state,
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
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};
