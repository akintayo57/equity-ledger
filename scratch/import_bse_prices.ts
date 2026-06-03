import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  connectFirestoreEmulator, 
  collection, 
  getDocs, 
  writeBatch, 
  doc 
} from 'firebase/firestore';

// Parse command line options
const isLocal = process.argv.includes('--local');
const isCloud = process.argv.includes('--cloud');

if (!isLocal && !isCloud) {
  console.error('Error: Please specify either --local or --cloud environment.');
  process.exit(1);
}

// Load appropriate env file
const envFile = isLocal ? '.env.workstation' : '.env.development';
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

if (isLocal) {
  console.log('Connecting to local Firestore emulator at localhost:8080...');
  connectFirestoreEmulator(db, 'localhost', 8080);
} else {
  console.log(`Connecting to cloud Firestore project: ${process.env.VITE_FIREBASE_PROJECT_ID}...`);
}

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

function getSecurityId(symbol: string): string {
  const mapping: Record<string, string> = {
    'CIBC': 'sec-9',
    'FCI': 'sec-9',
  };
  const sym = symbol.toUpperCase();
  return mapping[sym] || `sec-${sym.toLowerCase()}`;
}

async function main() {
  try {
    // 1. Load securities from bse_securities.csv and write to Firestore
    const secCsvPath = path.resolve('equity-ledger/exports/bse_securities.csv');
    if (!fs.existsSync(secCsvPath)) {
      throw new Error(`File not found at: ${secCsvPath}`);
    }
    console.log(`Reading BSE securities from: ${secCsvPath}`);
    const secCsvContent = fs.readFileSync(secCsvPath, 'utf-8');
    const secRows = parseCSV(secCsvContent);
    const secHeaders = secRows[0];
    const secColMap: Record<string, number> = {};
    secHeaders.forEach((h, idx) => {
      secColMap[h.toLowerCase()] = idx;
    });

    console.log(`Upserting ${secRows.length - 1} BSE securities...`);
    const secBatch = writeBatch(db);
    const tickerToDocId: Record<string, string> = {};

    for (let i = 1; i < secRows.length; i++) {
      const row = secRows[i];
      if (row.length < secHeaders.length) continue;

      const symbol = row[secColMap['symbol']].toUpperCase();
      const name = row[secColMap['name']];
      const sector = row[secColMap['sector']] || 'Financials';
      const status = row[secColMap['status']].toUpperCase();

      const docId = getSecurityId(symbol);
      tickerToDocId[symbol] = docId;

      // Determine currency
      let currency = 'BBD';
      if (symbol === 'PBSLO' || symbol === 'PBSL925') {
        currency = 'USD';
      } else if (symbol === 'PBSL1050' || symbol === 'PBSL975') {
        currency = 'JMD';
      }

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
      secBatch.set(docRef, securityDoc);
    }
    await secBatch.commit();
    console.log('Securities synced successfully.');

    // 2. Read prices.csv
    const csvPath = path.resolve('equity-ledger/exports/bse_prices.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`File not found at: ${csvPath}`);
    }
    
    console.log(`Reading prices from: ${csvPath}`);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvContent);
    
    if (rows.length === 0) {
      throw new Error('CSV file is empty');
    }

    const headers = rows[0];
    const colMap: Record<string, number> = {};
    headers.forEach((h, idx) => {
      colMap[h.toLowerCase()] = idx;
    });

    const requiredCols = ['symbol', 'price_date', 'close_price'];
    for (const col of requiredCols) {
      if (!(col in colMap)) {
        throw new Error(`Missing required CSV column: ${col}`);
      }
    }

    const startDate = '2026-05-01';
    const endDate = '2026-06-01';
    const filteredPrices = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < headers.length) continue;

      const symbol = row[colMap['symbol']].toUpperCase();
      const date = row[colMap['price_date']];
      const closePriceStr = row[colMap['close_price']];
      const notes = colMap['notes'] !== undefined ? row[colMap['notes']] : '';

      if (date < startDate || date > endDate) {
        continue;
      }

      const closePrice = parseFloat(closePriceStr);
      if (isNaN(closePrice)) {
        console.warn(`Warning: Skipping row with invalid price for ${symbol} on ${date}: ${closePriceStr}`);
        continue;
      }

      const securityId = tickerToDocId[symbol];
      if (!securityId) {
        console.warn(`Warning: Could not find Firestore security mapping for ticker: ${symbol}`);
        continue;
      }

      // Determine currency
      let currency = 'BBD';
      if (symbol === 'PBSLO' || symbol === 'PBSL925') {
        currency = 'USD';
      } else if (symbol === 'PBSL1050' || symbol === 'PBSL975') {
        currency = 'JMD';
      }

      const docId = `px-${securityId}-${date}`;
      filteredPrices.push({
        id: docId,
        securityId,
        date,
        price: closePrice,
        currency,
        source: 'BSE Daily Close',
        notes: notes || undefined
      });
    }

    console.log(`Filtered ${filteredPrices.length} BSE price updates for range ${startDate} to ${endDate}.`);

    if (filteredPrices.length === 0) {
      console.log('No prices to upload within specified range.');
      return;
    }

    // 3. Batch Upload to Firestore
    console.log(`Starting batch upload of ${filteredPrices.length} prices in chunks of 500...`);
    const chunkSize = 500;
    for (let i = 0; i < filteredPrices.length; i += chunkSize) {
      const chunk = filteredPrices.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      for (const px of chunk) {
        const docRef = doc(db, 'prices', px.id);
        batch.set(docRef, px);
      }

      await batch.commit();
      console.log(`  Uploaded prices chunk ${i + chunk.length}/${filteredPrices.length}`);
    }

    console.log('BSE Seeding and Import completed successfully!');
  } catch (error) {
    console.error('Error during import execution:', error);
    process.exit(1);
  }
}

main();
