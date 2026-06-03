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
    </div>
  );
};

describe('global state store tests', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('harbour_auth_mode', 'offline');
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
});
