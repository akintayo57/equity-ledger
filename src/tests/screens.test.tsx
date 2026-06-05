import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from '../store';
import { Dashboard } from '../screens/Dashboard';
import { Markets } from '../screens/Markets';
import { Portfolio } from '../screens/Portfolio';
import { HoldingDetail } from '../screens/HoldingDetail';
import { DataSettings } from '../screens/DataSettings';
import { Login } from '../components/Login';
import { Layout } from '../components/Layout';
import App from '../App';

// Enable offline auth mode for evaluator
localStorage.setItem('harbour_auth_mode', 'offline');

const mockUser = {
  uid: 'test-user-uid',
  email: 'test@harbour.finance',
  displayName: 'Test User',
  isAnonymous: true,
} as any;

const renderWithContext = (ui: React.ReactNode, initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <StoreProvider user={mockUser}>
        {ui}
      </StoreProvider>
    </MemoryRouter>
  );
};

describe('Dashboard screen tests', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('harbour_auth_mode', 'offline');
  });

  it('should render Dashboard screen successfully', async () => {
    renderWithContext(<Dashboard />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Total Value/i)).toBeInTheDocument();
    expect(screen.getByText('Largest Holdings')).toBeInTheDocument();
  });
});

describe('Markets screen tests', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('harbour_auth_mode', 'offline');
  });

  it('should render Markets screen with regional indices and movers list', async () => {
    renderWithContext(<Markets />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(screen.getByText('Markets')).toBeInTheDocument();
    expect(screen.getByText('GASCI Index')).toBeInTheDocument();
    expect(screen.getByText('BSE Index')).toBeInTheDocument();
    expect(screen.getByText('Relevant Corporate News')).toBeInTheDocument();
    expect(screen.getByText('Top Gainers')).toBeInTheDocument();
    expect(screen.getByText('Top Losers')).toBeInTheDocument();

    const bseFilter = screen.getByRole('button', { name: 'BSE' });
    await act(async () => {
      fireEvent.click(bseFilter);
    });
  });
});

describe('Portfolio tab switcher tests', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('harbour_auth_mode', 'offline');
  });

  it('should render Portfolio wrapper and navigate through sub-tabs', async () => {
    renderWithContext(<Portfolio />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Check tabs rendering
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Holdings')).toBeInTheDocument();
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();

    // Click Holdings tab
    const holdingsTab = screen.getByText('Holdings');
    await act(async () => {
      fireEvent.click(holdingsTab);
    });
    expect(screen.getByPlaceholderText('Search holdings and market...')).toBeInTheDocument();

    // Click Watchlist tab
    const watchlistTab = screen.getByText('Watchlist');
    await act(async () => {
      fireEvent.click(watchlistTab);
    });
    expect(screen.getByPlaceholderText('Search watchlist and market...')).toBeInTheDocument();

    // Click Performance tab
    const performanceTab = screen.getByText('Performance');
    await act(async () => {
      fireEvent.click(performanceTab);
    });
    expect(screen.getByText('Overall Return')).toBeInTheDocument();

    // Click Transactions tab
    const transactionsTab = screen.getByText('Transactions');
    await act(async () => {
      fireEvent.click(transactionsTab);
    });
    expect(screen.getByText(/Transaction Ledger/i)).toBeInTheDocument();
  });
});

describe('HoldingDetail screen tests', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('harbour_auth_mode', 'offline');
  });

  it('should render HoldingDetail and support notes logging', async () => {
    // Render Detail screen with routing context for a valid mock security ID
    render(
      <MemoryRouter initialEntries={['/holdings/sec-1']}>
        <StoreProvider user={mockUser}>
          <Routes>
            <Route path="/holdings/:id" element={<HoldingDetail />} />
          </Routes>
        </StoreProvider>
      </MemoryRouter>
    );

    // sec-1 is GBTI (Guyana Bank for Trade and Industry Limited) in mockData
    const titleEls = await screen.findAllByText(/Guyana Bank for Trade and Industry/i);
    expect(titleEls[0]).toBeInTheDocument();
    expect(screen.getByText('Market Profile & Fundamentals')).toBeInTheDocument();
    
    // Switch to Research Notes tab
    const researchTab = screen.getByText(/Research Journal/i);
    await act(async () => {
      fireEvent.click(researchTab);
    });

    // Click Log Business Note button to open the form
    const logBtn = screen.getByText('Log Business Note');
    await act(async () => {
      fireEvent.click(logBtn);
    });

    // Form inputs should be visible
    expect(screen.getByText('Write Research Synopsis')).toBeInTheDocument();
  });
});

describe('DataSettings screen tests', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('harbour_auth_mode', 'offline');
  });

  it('should render DataSettings and support user logout action', async () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadMock },
    });

    renderWithContext(<DataSettings />);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // It renders the select labeled "Settings Menu"
    const menuLabel = screen.getByText('Settings Menu');
    expect(menuLabel).toBeInTheDocument();

    // Select profile section to render ProfileSection
    const select = screen.getByLabelText('Settings Menu');
    await act(async () => {
      fireEvent.change(select, { target: { value: 'PROFILE' } });
    });

    const logoutBtn = screen.getByText('Logout');
    expect(logoutBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(logoutBtn);
    });

    expect(reloadMock).toHaveBeenCalled();
  });
});

describe('Login screen tests', () => {
  it('should render Login options and support sign-in buttons', async () => {
    render(<Login />);

    expect(screen.getByText('Harbour Finance')).toBeInTheDocument();
    
    const guestBtn = screen.getByText('Continue as Guest / Developer');
    expect(guestBtn).toBeInTheDocument();
    
    const googleBtn = screen.getByText('Continue with Google');
    expect(googleBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(guestBtn);
    });
  });
});

describe('App root initialization tests', () => {
  it('should render root App initializing spinner', async () => {
    render(<App />);
    expect(screen.getByText(/Initializing Harbour Finance.../i)).toBeInTheDocument();
  });
});
