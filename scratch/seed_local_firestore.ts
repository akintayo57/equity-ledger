import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  connectFirestoreEmulator, 
  writeBatch, 
  doc 
} from 'firebase/firestore';
import { 
  getAuth, 
  connectAuthEmulator, 
  signInAnonymously 
} from 'firebase/auth';

// Load environment configuration from .env.workstation
const envFile = '.env.workstation';
console.log(`Loading environment config from ${envFile}...`);
dotenv.config({ path: envFile });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

console.log('Connecting to local Firestore emulator at localhost:8080...');
connectFirestoreEmulator(db, 'localhost', 8080);
console.log('Connecting to local Auth emulator at http://localhost:9099...');
connectAuthEmulator(auth, 'http://localhost:9099');

function parseCSV(content: string): string[][] {
  const lines = content.split('\n');
  return lines.map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }).filter(line => line.length > 1);
}

function getSecurityId(symbol: string, exchange: string): string {
  const mapping: Record<string, string> = {
    'CIBC': 'sec-9',
    'FCI': 'sec-9',
  };
  const sym = symbol.toUpperCase();
  if (exchange === 'BSE' && mapping[sym]) {
    return mapping[sym];
  }
  return `sec-${sym.toLowerCase()}`;
}

async function seedExchanges() {
  const batch = writeBatch(db);
  const exchanges = [
    { id: 'GASCI', name: 'Guyana Stock Exchange', country: 'Guyana', currency: 'GYD' },
    { id: 'BSE', name: 'Barbados Stock Exchange', country: 'Barbados', currency: 'BBD' },
    { id: 'TTSE', name: 'Trinidad & Tobago Stock Exchange', country: 'Trinidad & Tobago', currency: 'TTD' },
    { id: 'JSE', name: 'Jamaica Stock Exchange', country: 'Jamaica', currency: 'JMD' }
  ];

  console.log('Syncing standard exchanges to Firestore exchanges collection...');
  for (const ex of exchanges) {
    const docRef = doc(db, 'exchanges', ex.id);
    batch.set(docRef, ex);
  }
  await batch.commit();
  console.log('Exchanges seeded successfully.');
}

async function seedSecurities() {
  const batch = writeBatch(db);
  const tickerToDocId: Record<string, { id: string, exchangeId: string, currency: string }> = {};

  // 1. Process BSE Securities
  const bseSecPath = path.resolve('equity-ledger/exports/bse_securities.csv');
  console.log(`Reading BSE securities from: ${bseSecPath}`);
  const bseSecContent = fs.readFileSync(bseSecPath, 'utf-8');
  const bseSecRows = parseCSV(bseSecContent);
  const bseSecHeaders = bseSecRows[0];
  const bseSecColMap: Record<string, number> = {};
  bseSecHeaders.forEach((h, idx) => { bseSecColMap[h.toLowerCase()] = idx; });

  for (let i = 1; i < bseSecRows.length; i++) {
    const row = bseSecRows[i];
    if (row.length < bseSecHeaders.length) continue;

    const symbol = row[bseSecColMap['symbol']].toUpperCase();
    const name = row[bseSecColMap['name']];
    const sector = row[bseSecColMap['sector']] || 'Financials';
    const status = row[bseSecColMap['status']].toUpperCase();

    const docId = getSecurityId(symbol, 'BSE');
    let currency = 'BBD';
    if (symbol === 'PBSLO' || symbol === 'PBSL925') {
      currency = 'USD';
    } else if (symbol === 'PBSL1050' || symbol === 'PBSL975') {
      currency = 'JMD';
    }

    tickerToDocId[symbol] = { id: docId, exchangeId: 'BSE', currency };

    const securityDoc = {
      id: docId,
      companyName: name,
      ticker: symbol,
      exchangeId: 'BSE',
      sector,
      status: 'ACTIVE',
      ...(currency !== 'BBD' ? { currency } : {})
    };

    const docRef = doc(db, 'securities', docId);
    batch.set(docRef, securityDoc);
  }

  // 2. Process GASCI Securities
  const gasciSecPath = path.resolve('equity-ledger/exports/securities.csv');
  console.log(`Reading GASCI securities from: ${gasciSecPath}`);
  const gasciSecContent = fs.readFileSync(gasciSecPath, 'utf-8');
  const gasciSecRows = parseCSV(gasciSecContent);
  const gasciSecHeaders = gasciSecRows[0];
  const gasciSecColMap: Record<string, number> = {};
  gasciSecHeaders.forEach((h, idx) => { gasciSecColMap[h.toLowerCase()] = idx; });

  for (let i = 1; i < gasciSecRows.length; i++) {
    const row = gasciSecRows[i];
    if (row.length < gasciSecHeaders.length) continue;

    const symbol = row[gasciSecColMap['symbol']].toUpperCase();
    const name = row[gasciSecColMap['name']];
    const sector = row[gasciSecColMap['sector']] || 'Financials';
    const status = row[gasciSecColMap['status']].toUpperCase();

    const docId = getSecurityId(symbol, 'GASCI');
    const currency = 'GYD';

    tickerToDocId[symbol] = { id: docId, exchangeId: 'GASCI', currency };

    const securityDoc = {
      id: docId,
      companyName: name,
      ticker: symbol,
      exchangeId: 'GASCI',
      sector,
      status: 'ACTIVE',
      ...(currency !== 'GYD' ? { currency } : {})
    };

    const docRef = doc(db, 'securities', docId);
    batch.set(docRef, securityDoc);
  }

  await batch.commit();
  console.log('Securities seeding complete!');
  return tickerToDocId;
}

async function seedPrices(tickerToDocId: Record<string, { id: string, exchangeId: string, currency: string }>) {
  const startDate = '2026-05-01';
  const endDate = '2026-06-01';
  const allPrices: any[] = [];

  // 1. Process BSE Prices
  const bsePricesPath = path.resolve('equity-ledger/exports/bse_prices.csv');
  console.log(`Reading BSE prices from: ${bsePricesPath}`);
  const bsePricesContent = fs.readFileSync(bsePricesPath, 'utf-8');
  const bsePricesRows = parseCSV(bsePricesContent);
  const bsePricesHeaders = bsePricesRows[0];
  const bsePricesColMap: Record<string, number> = {};
  bsePricesHeaders.forEach((h, idx) => { bsePricesColMap[h.toLowerCase()] = idx; });

  for (let i = 1; i < bsePricesRows.length; i++) {
    const row = bsePricesRows[i];
    if (row.length < bsePricesHeaders.length) continue;

    const symbol = row[bsePricesColMap['symbol']].toUpperCase();
    const date = row[bsePricesColMap['price_date']];
    const closePriceStr = row[bsePricesColMap['close_price']];
    const notes = bsePricesColMap['notes'] !== undefined ? row[bsePricesColMap['notes']] : '';

    if (date < startDate || date > endDate) continue;

    const closePrice = parseFloat(closePriceStr);
    if (isNaN(closePrice)) continue;

    const mapping = tickerToDocId[symbol];
    if (!mapping || mapping.exchangeId !== 'BSE') continue;

    const docId = `px-${mapping.id}-${date}`;
    allPrices.push({
      id: docId,
      securityId: mapping.id,
      date,
      price: closePrice,
      currency: mapping.currency,
      source: 'BSE Daily Close',
      notes: notes || undefined
    });
  }

  // 2. Process GASCI Prices
  const gasciPricesPath = path.resolve('equity-ledger/exports/prices.csv');
  console.log(`Reading GASCI prices from: ${gasciPricesPath}`);
  const gasciPricesContent = fs.readFileSync(gasciPricesPath, 'utf-8');
  const gasciPricesRows = parseCSV(gasciPricesContent);
  const gasciPricesHeaders = gasciPricesRows[0];
  const gasciPricesColMap: Record<string, number> = {};
  gasciPricesHeaders.forEach((h, idx) => { gasciPricesColMap[h.toLowerCase()] = idx; });

  for (let i = 1; i < gasciPricesRows.length; i++) {
    const row = gasciPricesRows[i];
    if (row.length < gasciPricesHeaders.length) continue;

    const symbol = row[gasciPricesColMap['symbol']].toUpperCase();
    const date = row[gasciPricesColMap['price_date']];
    const closePriceStr = row[gasciPricesColMap['close_price']];
    const notes = gasciPricesColMap['notes'] !== undefined ? row[gasciPricesColMap['notes']] : '';

    if (date < startDate || date > endDate) continue;

    const closePrice = parseFloat(closePriceStr);
    if (isNaN(closePrice)) continue;

    const mapping = tickerToDocId[symbol];
    if (!mapping || mapping.exchangeId !== 'GASCI') continue;

    const docId = `px-${mapping.id}-${date}`;
    allPrices.push({
      id: docId,
      securityId: mapping.id,
      date,
      price: closePrice,
      currency: mapping.currency,
      source: 'GASCI Daily Close',
      notes: notes || undefined
    });
  }

  console.log(`Starting batch upload of ${allPrices.length} total prices in chunks of 500...`);
  const chunkSize = 500;
  for (let i = 0; i < allPrices.length; i += chunkSize) {
    const chunk = allPrices.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const px of chunk) {
      const docRef = doc(db, 'prices', px.id);
      batch.set(docRef, px);
    }

    await batch.commit();
    console.log(`  Uploaded prices chunk ${i + chunk.length}/${allPrices.length}`);
  }

  console.log('Prices seeding complete!');
}

async function main() {
  try {
    console.log('Authenticating anonymously against local Auth emulator...');
    await signInAnonymously(auth);
    console.log('Authentication successful! Starting Firestore seeding...');
    
    await seedExchanges();
    const tickerMap = await seedSecurities();
    await seedPrices(tickerMap);
    console.log('Local Firestore database successfully populated with GASCI and BSE datasets!');
    process.exit(0);
  } catch (error) {
    console.error('Error during local seeding execution:', error);
    process.exit(1);
  }
}

main();
