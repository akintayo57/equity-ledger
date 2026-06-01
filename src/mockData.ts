import { Security, Account, Transaction, PriceUpdate, FXRate, Currency } from './types';

export const initialSecurities: Security[] = [
  { id: 'sec-1', companyName: 'Guyana Bank for Trade and Industry Limited', ticker: 'GBTI', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Financials', status: 'ACTIVE', fundamentals: { peRatio: 12.5, eps: 45.2, dividendYield: 2.1, pbRatio: 1.4, roe: 15.2, lastUpdated: '2023-12-31' } },
  { id: 'sec-2', companyName: 'Demerara Bank Limited', ticker: 'DBL', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Financials', status: 'ACTIVE', fundamentals: { peRatio: 14.1, eps: 15.0, dividendYield: 3.5, pbRatio: 2.1, roe: 18.4, lastUpdated: '2023-12-31' } },
  { id: 'sec-3', companyName: 'Banks DIH Limited', ticker: 'DIH', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Consumer Staples', status: 'ACTIVE', fundamentals: { peRatio: 8.5, eps: 14.1, dividendYield: 4.2, pbRatio: 1.1, roe: 11.2, lastUpdated: '2023-12-31' } },
  { id: 'sec-4', companyName: 'Demerara Distillers Limited', ticker: 'DDL', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Consumer Staples', status: 'ACTIVE', fundamentals: { peRatio: 10.2, eps: 17.5, dividendYield: 2.8, pbRatio: 1.5, roe: 13.5, lastUpdated: '2023-12-31' } },
  { id: 'sec-5', companyName: 'Republic Financial Holdings', ticker: 'RFHL', exchange: 'TTSE', country: 'Trinidad & Tobago', currency: 'TTD', sector: 'Financials', status: 'ACTIVE', fundamentals: { peRatio: 11.0, eps: 12.2, dividendYield: 4.5, pbRatio: 1.3, roe: 14.8, lastUpdated: '2023-12-31' } },
  { id: 'sec-6', companyName: 'NCB Financial Group', ticker: 'NCBFG', exchange: 'JSE', country: 'Jamaica', currency: 'JMD', sector: 'Financials', status: 'ACTIVE', fundamentals: { peRatio: 9.8, eps: 6.5, dividendYield: 1.2, pbRatio: 1.0, roe: 10.1, lastUpdated: '2023-12-31' } },
  { id: 'sec-7', companyName: 'GraceKennedy', ticker: 'GKC', exchange: 'JSE', country: 'Jamaica', currency: 'JMD', sector: 'Consumer Staples', status: 'ACTIVE', fundamentals: { peRatio: 13.2, eps: 5.8, dividendYield: 2.5, pbRatio: 1.8, roe: 16.5, lastUpdated: '2023-12-31' } },
  { id: 'sec-8', companyName: 'Massy Holdings', ticker: 'MASSY', exchange: 'TTSE', country: 'Trinidad & Tobago', currency: 'TTD', sector: 'Industrials', status: 'ACTIVE', fundamentals: { peRatio: 15.5, eps: 4.2, dividendYield: 3.1, pbRatio: 2.0, roe: 12.4, lastUpdated: '2023-12-31' } },
  { id: 'sec-9', companyName: 'FirstCaribbean International Bank', ticker: 'FCI', exchange: 'BSE', country: 'Barbados', currency: 'BBD', sector: 'Financials', status: 'ACTIVE', fundamentals: { peRatio: 10.5, eps: 0.18, dividendYield: 5.0, pbRatio: 0.9, roe: 8.5, lastUpdated: '2023-12-31' } },
  
  // Additional GASCI Equities from collected dataset
  { id: 'sec-bdh', companyName: 'Banks DIH Holdings Inc.', ticker: 'BDH', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Consumer Staples', status: 'ACTIVE' },
  { id: 'sec-cbi', companyName: 'Citizens Bank Guyana Incorporated', ticker: 'CBI', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Financials', status: 'ACTIVE' },
  { id: 'sec-cci', companyName: 'Caribbean Container Incorporated', ticker: 'CCI', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Industrials', status: 'ACTIVE' },
  { id: 'sec-cjl', companyName: 'City Jewelers and Pawnbrokers Limited', ticker: 'CJL', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Consumer Cyclical', status: 'ACTIVE' },
  { id: 'sec-dtc', companyName: 'Demerara Tobacco Company Limited', ticker: 'DTC', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Consumer Staples', status: 'ACTIVE' },
  { id: 'sec-gncb', companyName: 'Guyana National Co-operative Bank', ticker: 'GNCB', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Financials', status: 'ACTIVE' },
  { id: 'sec-gsi', companyName: 'Guyana Stockfeeds Incorporated', ticker: 'GSI', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Consumer Staples', status: 'ACTIVE' },
  { id: 'sec-gti', companyName: 'Globe Trust & Investment Company Limited', ticker: 'GTI', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Financials', status: 'ACTIVE' },
  { id: 'sec-hcl', companyName: 'Humphrey & Company Limited', ticker: 'HCL', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Financials', status: 'ACTIVE' },
  { id: 'sec-jps', companyName: 'J.P. Santos & Company Limited', ticker: 'JPS', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Services', status: 'ACTIVE' },
  { id: 'sec-nbi', companyName: 'National Bank of Industry & Commerce Ltd', ticker: 'NBI', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Financials', status: 'ACTIVE' },
  { id: 'sec-phi', companyName: 'Property Holdings Incorporated', ticker: 'PHI', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Real Estate', status: 'ACTIVE' },
  { id: 'sec-rbl', companyName: 'Republic Bank (Guyana) Limited', ticker: 'RBL', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Financials', status: 'ACTIVE' },
  { id: 'sec-rdl', companyName: 'Rupununi Development Company Limited', ticker: 'RDL', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Consumer Staples', status: 'ACTIVE' },
  { id: 'sec-spl', companyName: 'Sterling Products Limited', ticker: 'SPL', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Consumer Staples', status: 'ACTIVE' },
  { id: 'sec-tcl', companyName: 'Trinidad Cement Limited', ticker: 'TCL', exchange: 'GASCI', country: 'Guyana', currency: 'GYD', sector: 'Industrials', status: 'ACTIVE' },
];

export const initialWatchlist: string[] = ['sec-2', 'sec-4', 'sec-7'];

export const initialAccounts: Account[] = [
  { id: 'acc-1', brokerName: 'Guyana Americas Merchant Bank', country: 'Guyana', baseCurrency: 'GYD', notes: 'Main Guyana account' },
  { id: 'acc-2', brokerName: 'JMMB Securities', country: 'Jamaica', baseCurrency: 'JMD' },
  { id: 'acc-3', brokerName: 'Direct Certificate', country: 'Guyana', baseCurrency: 'GYD', notes: 'Physical share certificates' },
];

export const initialTransactions: Transaction[] = [
  // GBTI (Buy, Dividend, Buy)
  { id: 'tx-1', securityId: 'sec-1', accountId: 'acc-1', date: '2022-01-15', type: 'BUY', shares: 500, pricePerShare: 650, currency: 'GYD', fees: 2000, notes: 'Initial investment' },
  { id: 'tx-2', securityId: 'sec-1', accountId: 'acc-1', date: '2023-01-10', type: 'DIVIDEND', shares: 0, pricePerShare: 20, currency: 'GYD', fees: 0, notes: 'Annual dividend' },
  { id: 'tx-3', securityId: 'sec-1', accountId: 'acc-1', date: '2024-02-05', type: 'BUY', shares: 200, pricePerShare: 780, currency: 'GYD', fees: 1000 },
  
  // Banks DIH (Buy, Sell taking partial profit)
  { id: 'tx-4', securityId: 'sec-3', accountId: 'acc-1', date: '2023-04-10', type: 'BUY', shares: 2000, pricePerShare: 120, currency: 'GYD', fees: 1500 },
  { id: 'tx-5', securityId: 'sec-3', accountId: 'acc-1', date: '2024-10-15', type: 'SELL', shares: 500, pricePerShare: 140, currency: 'GYD', fees: 500, notes: 'Taking some profit' },
  
  // Republic Financial (Stale data demo)
  { id: 'tx-6', securityId: 'sec-5', accountId: 'acc-2', date: '2023-06-20', type: 'BUY', shares: 100, pricePerShare: 135, currency: 'TTD', fees: 50 },
  
  // GraceKennedy (Dollar cost averaging, Gain demo)
  { id: 'tx-7', securityId: 'sec-7', accountId: 'acc-2', date: '2023-08-15', type: 'BUY', shares: 1000, pricePerShare: 70, currency: 'JMD', fees: 1000 },
  { id: 'tx-8', securityId: 'sec-7', accountId: 'acc-2', date: '2024-01-20', type: 'BUY', shares: 500, pricePerShare: 65, currency: 'JMD', fees: 500 },
  { id: 'tx-9', securityId: 'sec-7', accountId: 'acc-2', date: '2024-12-01', type: 'SELL', shares: 200, pricePerShare: 78, currency: 'JMD', fees: 200 },

  // FirstCaribbean (Loss demo)
  { id: 'tx-10', securityId: 'sec-9', accountId: 'acc-1', date: '2023-11-01', type: 'BUY', shares: 2000, pricePerShare: 2.1, currency: 'BBD', fees: 15 },
];

// Helpers to generate weekly historical prices and exchange rates over 6 months
const generatePriceHistory = (securityId: string, startPrice: number, currency: Currency, exchange: string) => {
  const prices: PriceUpdate[] = [];
  let currentPrice = startPrice;
  const totalWeeks = 26; // 6 months of weekly points
  
  for (let i = totalWeeks; i >= 0; i--) {
    const date = new Date(Date.now() - i * 7 * 86400000).toISOString().split('T')[0];
    // Modest random fluctuation (+/- 2.5%) with a small positive drift
    const change = 1 + (Math.random() * 0.05 - 0.023);
    currentPrice = Number((currentPrice * change).toFixed(2));
    
    prices.push({
      id: `px-${securityId}-${i}`,
      securityId,
      date,
      price: currentPrice,
      currency,
      source: `${exchange} Weekly Close`
    });
  }
  return prices;
};

const generateFXHistory = (fromCurrency: Currency, toCurrency: Currency, baseRate: number, source: string) => {
  const fxList: FXRate[] = [];
  let currentRate = baseRate;
  const totalWeeks = 26;
  
  for (let i = totalWeeks; i >= 0; i--) {
    const date = new Date(Date.now() - i * 7 * 86400000).toISOString().split('T')[0];
    // Minor exchange rate fluctuations (+/- 0.5%)
    const change = 1 + (Math.random() * 0.01 - 0.005);
    currentRate = Number((currentRate * change).toFixed(4));
    
    fxList.push({
      id: `fx-${fromCurrency}-${toCurrency}-${i}`,
      fromCurrency,
      toCurrency,
      date,
      rate: currentRate,
      source
    });
  }
  return fxList;
};

export const initialPrices: PriceUpdate[] = [
  ...generatePriceHistory('sec-1', 820, 'GYD', 'GASCI'),
  ...generatePriceHistory('sec-2', 210, 'GYD', 'GASCI'),
  ...generatePriceHistory('sec-3', 145, 'GYD', 'GASCI'),
  ...generatePriceHistory('sec-4', 180, 'GYD', 'GASCI'),
  ...generatePriceHistory('sec-5', 130, 'TTD', 'TTSE'),
  ...generatePriceHistory('sec-6', 95, 'JMD', 'JSE'),
  ...generatePriceHistory('sec-7', 82, 'JMD', 'JSE'),
  ...generatePriceHistory('sec-8', 15.5, 'TTD', 'TTSE'),
  ...generatePriceHistory('sec-9', 1.85, 'BBD', 'BSE')
];

export const initialFXRates: FXRate[] = [
  ...generateFXHistory('USD', 'GYD', 208.5, 'Central Bank of Guyana'),
  ...generateFXHistory('USD', 'TTD', 6.78, 'Central Bank TT'),
  ...generateFXHistory('USD', 'JMD', 155.2, 'BOJ'),
  ...generateFXHistory('USD', 'BBD', 2.02, 'Fixed'),
  ...generateFXHistory('USD', 'XCD', 2.7, 'Fixed')
];
