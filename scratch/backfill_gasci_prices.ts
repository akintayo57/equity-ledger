import * as fs from 'fs';
import * as os from 'os';
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

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'harbour-finance-902b';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: projectId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

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
  const sym = symbol.toUpperCase();
  if (sym === 'BTI') return 'sec-1';
  if (sym === 'DBL') return 'sec-2';
  if (sym === 'DIH') return 'sec-3';
  if (sym === 'DDL') return 'sec-4';
  return `sec-${sym.toLowerCase()}`;
}

function convertDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  return `${year}-${month}-${day}`;
}

function toFirestoreValue(val: any): any {
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (typeof val === 'number') {
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object' && val !== null) {
    const fields: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      fields[k] = toFirestoreValue(val[k]);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

async function uploadLocal(priceUpdates: any[]) {
  console.log('Connecting to local Firestore emulator...');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');

  console.log('Authenticating anonymously against local Auth emulator...');
  await signInAnonymously(auth);
  console.log('Authentication successful!');

  console.log(`Starting batch upload of ${priceUpdates.length} prices to local emulator in chunks of 500...`);
  const chunkSize = 500;
  for (let i = 0; i < priceUpdates.length; i += chunkSize) {
    const chunk = priceUpdates.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const px of chunk) {
      const docRef = doc(db, 'prices', px.id);
      batch.set(docRef, px);
    }

    await batch.commit();
    console.log(`  Uploaded local prices chunk ${i + chunk.length}/${priceUpdates.length}`);
  }
}

async function uploadCloud(priceUpdates: any[]) {
  console.log('Using Firestore REST API with CLI credentials to update Cloud...');
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Firebase CLI config not found at ${configPath}. Please run "firebase login" first.`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const accessToken = config.tokens?.access_token;
  if (!accessToken) {
    throw new Error('Access token not found in Firebase CLI config.');
  }

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
  
  console.log(`Starting cloud REST upload of ${priceUpdates.length} prices in chunks of 200...`);
  const chunkSize = 200;
  
  for (let i = 0; i < priceUpdates.length; i += chunkSize) {
    const chunk = priceUpdates.slice(i, i + chunkSize);
    const writes = chunk.map(px => {
      const docPath = `projects/${projectId}/databases/(default)/documents/prices/${px.id}`;
      const fields: Record<string, any> = {};
      for (const [key, val] of Object.entries(px)) {
        fields[key] = toFirestoreValue(val);
      }
      return {
        update: {
          name: docPath,
          fields
        }
      };
    });

    const res = await fetch(commitUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ writes })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Cloud commit failed: ${res.statusText} (${res.status}) - ${errorText}`);
    }

    console.log(`  Uploaded cloud prices chunk ${i + chunk.length}/${priceUpdates.length}`);
  }
}

async function main() {
  try {
    const csvPath = path.resolve('collected_dataset/gse_history_all.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`File not found at: ${csvPath}`);
    }

    console.log(`Reading GASCI Stock Prices from: ${csvPath}`);
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

    const requiredCols = ['symbol', 'session_date', 'last_trade_price'];
    for (const col of requiredCols) {
      if (!(col in colMap)) {
        throw new Error(`Missing required CSV column: ${col}`);
      }
    }

    const priceUpdates = [];
    console.log(`Parsing ${rows.length - 1} price rows...`);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < headers.length) continue;

      const symbol = row[colMap['symbol']].toUpperCase();
      const rawDateStr = row[colMap['session_date']];
      const lastTradePriceStr = row[colMap['last_trade_price']];
      const notes = colMap['notes'] !== undefined ? row[colMap['notes']] : '';

      if (!rawDateStr || !lastTradePriceStr) continue;

      let date;
      try {
        date = convertDate(rawDateStr);
      } catch (err) {
        continue; // skip invalid date format
      }

      const price = parseFloat(lastTradePriceStr);
      if (isNaN(price)) {
        continue; // skip invalid price
      }

      const securityId = getSecurityId(symbol);
      const docId = `px-${securityId}-${date}`;

      priceUpdates.push({
        id: docId,
        securityId,
        date,
        price,
        currency: 'GYD',
        source: 'GASCI Historical Import',
        ...(notes && notes !== '-' ? { notes } : {})
      });
    }

    console.log(`Parsed ${priceUpdates.length} valid GASCI price updates.`);

    if (priceUpdates.length === 0) {
      console.log('No price updates to import.');
      return;
    }

    if (isLocal) {
      await uploadLocal(priceUpdates);
    } else {
      await uploadCloud(priceUpdates);
    }

    console.log('GASCI Stock Prices Backfill completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during backfill execution:', error);
    process.exit(1);
  }
}

main();
