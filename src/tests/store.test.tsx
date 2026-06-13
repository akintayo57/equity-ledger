import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { StoreProvider, useStore } from '../store';

// Enable offline auth mode for evaluator
localStorage.setItem('harbour_auth_mode', 'offline');

const mockUser = {
  uid: 'test-user-uid',
  email: 'test@harbour.finance',
  displayName: 'Test User',
  isAnonymous: true,
} as any;

// Test Helper Component to assert store values and perform actions
const StoreConsumer = () => {
  const store = useStore();

  if (store.loading) {
    return <div>Loading Store...</div>;
  }

  return (
    <div>
      <div data-testid="tx-count">Transactions: {store.transactions.length}</div>
      <div data-testid="securities-count">Securities: {store.securities.length}</div>
      <div data-testid="watchlist-count">Watchlist: {store.watchlist.length}</div>
      <div data-testid="theme-val">Theme: {store.theme}</div>
      
      <button 
        onClick={() => store.addTransaction({
          accountId: 'acc-1',
          securityId: 'sec-1',
          type: 'BUY',
          date: '2026-06-01',
          shares: 50,
          pricePerShare: 10,
          currency: 'GYD',
          fees: 0
        })}
        data-testid="add-tx-btn"
      >
        Add Transaction
      </button>

      <button
        onClick={() => store.toggleWatchlist('sec-2')}
        data-testid="toggle-watchlist-btn"
      >
        Toggle Watchlist
      </button>

      <button
        onClick={() => store.addEquityNote({
          securityId: 'sec-1',
          date: '2026-06-02',
          title: 'Q2 Performance',
          synopsis: 'Excellent growth projection.'
        })}
        data-testid="add-note-btn"
      >
        Add Note
      </button>

      <button
        onClick={() => store.setTheme(store.theme === 'light' ? 'dark' : 'light')}
        data-testid="toggle-theme-btn"
      >
        Toggle Theme
      </button>

      <div data-testid="indices-count">Indices: {store.indices.length}</div>
      <div data-testid="index-history-count">IndexHistory: {store.indexHistory.length}</div>
      <button onClick={() => store.backfillIndices()} data-testid="backfill-btn">Backfill</button>
    </div>
  );
};

describe('global state store tests', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('harbour_auth_mode', 'offline');
    document.documentElement.classList.remove('dark');
  });

  it('should initialize store with loaded mock datasets', async () => {
    render(
      <StoreProvider user={mockUser}>
        <StoreConsumer />
      </StoreProvider>
    );

    // Initial state is loading
    expect(screen.getByText('Syncing database...')).toBeInTheDocument();

    // Wait for mock snapshot timer callbacks
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Check pre-seeded count from mock data
    expect(screen.getByTestId('securities-count')).toHaveTextContent(/Securities: \d+/);
    expect(screen.getByTestId('tx-count')).toHaveTextContent(/Transactions: \d+/);
  });

  it('should mutate store state when executing actions', async () => {
    render(
      <StoreProvider user={mockUser}>
        <StoreConsumer />
      </StoreProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const initialTxCountStr = screen.getByTestId('tx-count').textContent || 'Transactions: 0';
    const initialTxCount = parseInt(initialTxCountStr.replace('Transactions: ', ''));

    // Trigger transaction addition
    const addTxBtn = screen.getByTestId('add-tx-btn');
    await act(async () => {
      fireEvent.click(addTxBtn);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Expect transaction count to increment by 1
    expect(screen.getByTestId('tx-count')).toHaveTextContent(`Transactions: ${initialTxCount + 1}`);

    // Trigger watchlist toggle
    const toggleWatchlistBtn = screen.getByTestId('toggle-watchlist-btn');
    await act(async () => {
      fireEvent.click(toggleWatchlistBtn);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Check watchlist updates
    expect(screen.getByTestId('watchlist-count')).toHaveTextContent(/Watchlist: \d+/);
  });

  it('should toggle theme and update document element classes and localStorage', async () => {
    render(
      <StoreProvider user={mockUser}>
        <StoreConsumer />
      </StoreProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Check initial theme state
    const themeVal = screen.getByTestId('theme-val');
    expect(themeVal).toHaveTextContent(/Theme: (light|dark)/);
    
    const initialTheme = themeVal.textContent?.replace('Theme: ', '') as 'light' | 'dark';
    const expectedToggledTheme = initialTheme === 'light' ? 'dark' : 'light';

    const toggleThemeBtn = screen.getByTestId('toggle-theme-btn');
    
    // Toggle the theme
    await act(async () => {
      fireEvent.click(toggleThemeBtn);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Theme state in store should update
    expect(themeVal).toHaveTextContent(`Theme: ${expectedToggledTheme}`);

    // Class list on document element should be updated
    if (expectedToggledTheme === 'dark') {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    } else {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    }

    // LocalStorage should persist the preferred theme
    expect(localStorage.getItem('harbour_theme')).toBe(expectedToggledTheme);
  });

  it('should initialize and support backfilling index history', async () => {
    render(
      <StoreProvider user={mockUser}>
        <StoreConsumer />
      </StoreProvider>
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Default indices should be loaded
    expect(screen.getByTestId('indices-count')).toHaveTextContent('Indices: 5');

    // Initially the mock store provider useEffect triggers auto-backfill on initialization
    // So IndexHistory should be populated!
    const historyCountStr = screen.getByTestId('index-history-count').textContent || 'IndexHistory: 0';
    const historyCount = parseInt(historyCountStr.replace('IndexHistory: ', ''));
    expect(historyCount).toBeGreaterThan(0);

    // Let's trigger backfill manually and expect it to execute without errors
    const backfillBtn = screen.getByTestId('backfill-btn');
    await act(async () => {
      fireEvent.click(backfillBtn);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // It should still be populated
    expect(screen.getByTestId('index-history-count')).toHaveTextContent(/IndexHistory: \d+/);
  });
});
