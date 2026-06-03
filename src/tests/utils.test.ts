import { describe, it, expect } from 'vitest';
import { formatMoney, formatPercentage, getPriceStaleStatus, getFXStaleStatus, calculateHoldings } from '../utils';
import { Security, Transaction, PriceUpdate, FXRate, Exchange } from '../types';
import { subDays } from 'date-fns';

describe('utils formatting tests', () => {
  it('should format money correctly', () => {
    expect(formatMoney(1234.56, 'USD')).toBe('$1,234.56');
    expect(formatMoney(0, 'BBD')).toBe('BBD 0.00'); // Note: non-breaking space
  });

  it('should format percentage correctly', () => {
    expect(formatPercentage(12.34)).toBe('12.34%');
    expect(formatPercentage(-5.6)).toBe('-5.60%');
  });
});

describe('utils stale checks tests', () => {
  it('should determine price stale status correctly', () => {
    expect(getPriceStaleStatus('')).toBe('MISSING');
    
    const freshDate = subDays(new Date(), 5).toISOString().split('T')[0];
    expect(getPriceStaleStatus(freshDate)).toBe('FRESH');
    
    const staleDate = subDays(new Date(), 40).toISOString().split('T')[0];
    expect(getPriceStaleStatus(staleDate)).toBe('STALE');
    
    const veryStaleDate = subDays(new Date(), 100).toISOString().split('T')[0];
    expect(getPriceStaleStatus(veryStaleDate)).toBe('VERY_STALE');
  });

  it('should determine FX stale status correctly', () => {
    expect(getFXStaleStatus('')).toBe('MISSING');
    
    const freshDate = subDays(new Date(), 5).toISOString().split('T')[0];
    expect(getFXStaleStatus(freshDate)).toBe('FRESH');
    
    const staleDate = subDays(new Date(), 20).toISOString().split('T')[0];
    expect(getFXStaleStatus(staleDate)).toBe('STALE');
  });
});

describe('calculateHoldings tests', () => {
  // Setup sample mock data
  const mockExchanges: Exchange[] = [
    { id: 'GASCI', name: 'Guyana Stock Exchange', country: 'Guyana', currency: 'GYD' },
    { id: 'BSE', name: 'Barbados Stock Exchange', country: 'Barbados', currency: 'BBD' }
  ];

  const mockSecurities: Security[] = [
    { id: 'GDI', companyName: 'Guyana Development Inc', ticker: 'GDI', exchangeId: 'GASCI', sector: 'Financial' },
    { id: 'BHL', companyName: 'Banks Barbados Ltd', ticker: 'BHL', exchangeId: 'BSE', sector: 'Beverage' }
  ];

  const mockPrices: PriceUpdate[] = [
    { id: 'p1', securityId: 'GDI', price: 150, date: '2026-06-01' },
    { id: 'p2', securityId: 'BHL', price: 10, date: '2026-06-01' }
  ];

  const mockFxRates: FXRate[] = [
    { id: 'fx1', fromCurrency: 'USD', toCurrency: 'GYD', rate: 200, date: '2026-05-01' },
    { id: 'fx2', fromCurrency: 'USD', toCurrency: 'BBD', rate: 2, date: '2026-05-01' }
  ];

  it('should calculate holdings correctly for a BUY and SELL transaction', () => {
    const transactions: Transaction[] = [
      { id: 't1', securityId: 'GDI', type: 'BUY', shares: 100, pricePerShare: 100, date: '2026-05-10', currency: 'GYD', fees: 10, accountId: 'acc1' },
      { id: 't2', securityId: 'GDI', type: 'SELL', shares: 50, pricePerShare: 120, date: '2026-05-15', currency: 'GYD', fees: 5, accountId: 'acc1' }
    ];

    const result = calculateHoldings(mockSecurities, transactions, mockPrices, mockFxRates, mockExchanges);
    
    // GDI shares owned should be 50 (100 bought - 50 sold)
    const gdiHolding = result.find(h => h.security.id === 'GDI');
    expect(gdiHolding).toBeDefined();
    expect(gdiHolding?.sharesOwned).toBe(50);
    
    // Total cost basis local currency = (100 * 100 + 10) = 10010 GYD. Average cost = 100.1 GYD.
    // Selling 50 shares reduces cost basis by 50 * 100.1 = 5005 GYD. Remaining cost basis = 5005 GYD.
    expect(gdiHolding?.totalCostBasis).toBe(5005);
    expect(gdiHolding?.averageCost).toBe(100.1);
    
    // Market value local = 50 shares * 150 price = 7500 GYD.
    expect(gdiHolding?.marketValueLocal).toBe(7500);
    
    // Market value USD = 7500 / 200 (rate) = 37.5 USD.
    expect(gdiHolding?.marketValueUSD).toBe(37.5);
    
    // Cost Basis USD = 5005 / 200 = 25.025 USD.
    expect(gdiHolding?.totalCostBasisUSD).toBeCloseTo(25.025, 3);
  });

  it('should adjust for stock splits chronologically', () => {
    const transactions: Transaction[] = [
      { id: 't1', securityId: 'BHL', type: 'BUY', shares: 100, pricePerShare: 6, date: '2026-05-10', currency: 'BBD', fees: 0, accountId: 'acc1' },
      // 2:1 stock split on 2026-05-12
      { id: 't2', securityId: 'BHL', type: 'SPLIT', shares: 2, pricePerShare: 0, date: '2026-05-12', currency: 'BBD', fees: 0, accountId: 'acc1' },
      { id: 't3', securityId: 'BHL', type: 'BUY', shares: 50, pricePerShare: 3.5, date: '2026-05-14', currency: 'BBD', fees: 0, accountId: 'acc1' }
    ];

    const result = calculateHoldings(mockSecurities, transactions, mockPrices, mockFxRates, mockExchanges);
    
    const bhlHolding = result.find(h => h.security.id === 'BHL');
    expect(bhlHolding).toBeDefined();
    
    // First buy (100 shares) is split 2:1 -> becomes 200 shares at $3 price.
    // Second buy (50 shares) happens after split -> remains 50 shares at $3.5.
    // Total shares owned = 200 + 50 = 250.
    expect(bhlHolding?.sharesOwned).toBe(250);
    
    // Total cost basis = 200 * $3 + 50 * $3.5 = $600 + $175 = $775.
    expect(bhlHolding?.totalCostBasis).toBe(775);
    expect(bhlHolding?.averageCost).toBe(3.1);
  });

  it('should accumulate total dividends received correctly', () => {
    const transactions: Transaction[] = [
      { id: 't1', securityId: 'GDI', type: 'BUY', shares: 100, pricePerShare: 100, date: '2026-05-10', currency: 'GYD', fees: 0, accountId: 'acc1' },
      { id: 't2', securityId: 'GDI', type: 'DIVIDEND', shares: 100, pricePerShare: 2.5, date: '2026-05-20', currency: 'GYD', fees: 0, accountId: 'acc1' }
    ];

    const result = calculateHoldings(mockSecurities, transactions, mockPrices, mockFxRates, mockExchanges);
    
    const gdiHolding = result.find(h => h.security.id === 'GDI');
    expect(gdiHolding).toBeDefined();
    
    // Dividend is 100 shares * 2.5 = 250 GYD.
    // USD dividend = 250 / 200 = 1.25 USD.
    expect(gdiHolding?.totalDividendsLocal).toBe(250);
    expect(gdiHolding?.totalDividendsUSD).toBe(1.25);
    
    // Dividend does not reduce cost basis
    expect(gdiHolding?.totalCostBasis).toBe(10000);
  });

  it('should calculate correct portfolio weights', () => {
    const transactions: Transaction[] = [
      { id: 't1', securityId: 'GDI', type: 'BUY', shares: 100, pricePerShare: 100, date: '2026-05-10', currency: 'GYD', fees: 0, accountId: 'acc1' }, // Value USD = 100 * 150 / 200 = 75 USD
      { id: 't2', securityId: 'BHL', type: 'BUY', shares: 10, pricePerShare: 5, date: '2026-05-10', currency: 'BBD', fees: 0, accountId: 'acc1' }   // Value USD = 10 * 10 / 2 = 50 USD
    ];

    const result = calculateHoldings(mockSecurities, transactions, mockPrices, mockFxRates, mockExchanges);
    
    // Total portfolio value in USD = 75 + 50 = 125 USD.
    // GDI weight = 75 / 125 = 60%.
    // BHL weight = 50 / 125 = 40%.
    const gdi = result.find(h => h.security.id === 'GDI');
    const bhl = result.find(h => h.security.id === 'BHL');
    
    expect(gdi?.portfolioWeight).toBe(60);
    expect(bhl?.portfolioWeight).toBe(40);
  });
});
