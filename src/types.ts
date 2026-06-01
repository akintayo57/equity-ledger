export type Currency = 'GYD' | 'JMD' | 'TTD' | 'BBD' | 'XCD' | 'USD';

export interface Fundamentals {
  peRatio?: number;
  eps?: number;
  dividendYield?: number;
  pbRatio?: number;
  roe?: number;
  lastUpdated?: string;
}

export interface Security {
  id: string;
  companyName: string;
  ticker: string;
  exchange: string;
  country: string;
  currency: Currency;
  sector: string;
  status: 'ACTIVE' | 'INACTIVE';
  fundamentals?: Fundamentals;
}

export interface Account {
  id: string;
  brokerName: string;
  country: string;
  baseCurrency: Currency;
  notes?: string;
}

export type TransactionType = 'BUY' | 'SELL' | 'FEE' | 'DIVIDEND';

export interface Transaction {
  id: string;
  securityId: string;
  accountId: string;
  date: string; // ISO string YYYY-MM-DD
  type: TransactionType;
  shares: number;
  pricePerShare: number;
  currency: Currency;
  fees: number;
  notes?: string;
}

export interface PriceUpdate {
  id: string;
  securityId: string;
  date: string; // ISO string YYYY-MM-DD
  price: number;
  currency: Currency;
  source: string;
  notes?: string;
}

export interface FXRate {
  id: string;
  fromCurrency: Currency;
  toCurrency: Currency;
  date: string; // ISO string YYYY-MM-DD
  rate: number; // e.g. 1 fromCurrency = rate toCurrency. For USD to GYD, from=USD, to=GYD, rate=208
  source: string;
}

// Derived Data Types
export interface HoldingCalculation {
  security: Security;
  sharesOwned: number;
  averageCost: number; // in security's local currency
  totalCostBasis: number; // in security's local currency
  totalCostBasisUSD: number; 
  lastPrice: number;
  lastPriceDate: string;
  priceStaleStatus: 'FRESH' | 'STALE' | 'VERY_STALE' | 'MISSING';
  marketValueLocal: number;
  marketValueUSD: number;
  unrealizedGainLocal: number;
  unrealizedGainLossPctLocal: number;
  unrealizedGainUSD: number;
  unrealizedGainLossPctUSD: number;
  portfolioWeight: number; // percentage 0-100
  fxRateToUSD: number;
  fxStaleStatus: 'FRESH' | 'STALE' | 'MISSING';
}

export interface PortfolioSummary {
  totalMarketValueUSD: number;
  totalCostBasisUSD: number;
  unrealizedGainUSD: number;
  capitalGrowthPct: number;
}
