import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  connectFirestoreEmulator, 
  writeBatch, 
  doc,
  collection,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  connectAuthEmulator, 
  signInAnonymously 
} from 'firebase/auth';

// ----------------------------------------------------
// 1. Index Configuration Metadata (Private Database-Side Only)
// ----------------------------------------------------
const INDEX_CONFIGS = [
  {
    id: 'GASCI',
    name: 'Guyana Stock Exchange Index',
    exchangeId: 'GASCI',
    currency: 'GYD',
    scale: 10,
    constituentIds: [
      'sec-1', 'sec-2', 'sec-3', 'sec-4', 'sec-bdh', 'sec-cbi',
      'sec-cci', 'sec-cjl', 'sec-dtc', 'sec-gsi', 'sec-hcl',
      'sec-jps', 'sec-phi', 'sec-rbl', 'sec-rdl', 'sec-spl', 'sec-tcl'
    ]
  },
  {
    id: 'BSE',
    name: 'Barbados Stock Exchange Index',
    exchangeId: 'BSE',
    currency: 'BBD',
    scale: 10,
    constituentIds: ['sec-9']
  },
  {
    id: 'JSE',
    name: 'Jamaica Stock Exchange Index',
    exchangeId: 'JSE',
    currency: 'JMD',
    scale: 10,
    constituentIds: ['sec-6', 'sec-7']
  },
  {
    id: 'TTSE',
    name: 'Trinidad and Tobago Stock Exchange Index',
    exchangeId: 'TTSE',
    currency: 'TTD',
    scale: 10,
    constituentIds: ['sec-5', 'sec-8']
  },
  {
    id: 'ECSE',
    name: 'Eastern Caribbean Securities Exchange Index',
    exchangeId: 'ECSE',
    currency: 'XCD',
    scale: 10,
    constituentIds: ['sec-bon', 'sec-ecfh', 'sec-wioc']
  }
];

// Interface definitions
interface PriceUpdate {
  id: string;
  securityId: string;
  date: string;
  price: number;
  currency: string;
  source: string;
}

interface Security {
  id: string;
  companyName: string;
  ticker: string;
  exchangeId: string;
  sector: string;
  status: 'ACTIVE' | 'INACTIVE';
  type: 'EQUITY' | 'INDEX' | 'BOND';
}

// Parse command line arguments
const isLocal = process.argv.includes('--local');
const isCloud = process.argv.includes('--cloud');

// Optional project override
let projectOverride: string | null = null;
const projectArgIndex = process.argv.indexOf('--project');
if (projectArgIndex !== -1 && projectArgIndex + 1 < process.argv.length) {
  projectOverride = process.argv[projectArgIndex + 1];
}

if (!isLocal && !isCloud) {
  console.error('Error: Please specify either --local or --cloud environment.');
  console.error('Usage: npx tsx scratch/backfill_indices_db.ts [--local | --cloud] [--project <project-id>]');
  process.exit(1);
}

// ----------------------------------------------------
// 2. Setup Configuration and Environment variables
// ----------------------------------------------------
const envFile = isLocal ? '.env.workstation' : '.env.development';
console.log(`Loading environment config from ${envFile}...`);
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else {
  console.warn(`Warning: Env file ${envFile} not found, relying on current process environment.`);
}

const projectId = projectOverride || process.env.VITE_FIREBASE_PROJECT_ID || 'harbour-finance-902b';
console.log(`Using Firebase Project ID: ${projectId}`);

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'mock-api-key',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost',
  projectId: projectId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:123456789:web:mock',
};

// ----------------------------------------------------
// 3. Firestore REST Conversion Helpers
// ----------------------------------------------------
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

function fromFirestoreValue(fieldVal: any): any {
  if (!fieldVal) return null;
  if ('stringValue' in fieldVal) return fieldVal.stringValue;
  if ('doubleValue' in fieldVal) return Number(fieldVal.doubleValue);
  if ('integerValue' in fieldVal) return Number(fieldVal.integerValue);
  if ('booleanValue' in fieldVal) return fieldVal.booleanValue;
  if ('nullValue' in fieldVal) return null;
  if ('arrayValue' in fieldVal) {
    const vals = fieldVal.arrayValue.values || [];
    return vals.map(fromFirestoreValue);
  }
  if ('mapValue' in fieldVal) {
    const fields = fieldVal.mapValue.fields || {};
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return null;
}

function parseFirestoreDocument(doc: any): any {
  const fields = doc.fields || {};
  const res: Record<string, any> = { id: doc.name.split('/').pop() };
  for (const [k, v] of Object.entries(fields)) {
    res[k] = fromFirestoreValue(v);
  }
  return res;
}

// ----------------------------------------------------
// 4. Cloud REST Fetching Helper
// ----------------------------------------------------
async function fetchCloudCollectionDocs(collectionName: string, headers: any, projectId: string): Promise<any[]> {
  const docs: any[] = [];
  let nextPageToken = '';
  do {
    let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}?pageSize=300`;
    if (nextPageToken) {
      url += `&pageToken=${nextPageToken}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 404) {
        return []; // Collection does not exist
      }
      throw new Error(`Failed to list docs in ${collectionName}: ${res.statusText} (${res.status})`);
    }
    const data = await res.json();
    if (data.documents) {
      docs.push(...data.documents);
    }
    nextPageToken = data.nextPageToken || '';
  } while (nextPageToken);
  return docs;
}

// Helper to unpack bucketed or legacy prices
function unpackPrices(docsData: any[]): PriceUpdate[] {
  const allPrices: PriceUpdate[] = [];
  docsData.forEach(data => {
    if (data.prices && Array.isArray(data.prices)) {
      data.prices.forEach((p: any) => allPrices.push({ ...p, id: `${p.securityId}_${p.date}` }));
    } else {
      allPrices.push(data);
    }
  });
  return allPrices;
}

// ----------------------------------------------------
// 5. Index Calculation Logic
// ----------------------------------------------------
function computeIndexPrices(allPrices: PriceUpdate[]): PriceUpdate[] {
  const computedIndexPrices: PriceUpdate[] = [];

  // Sort prices chronologically for consistency
  const sortedAllPrices = [...allPrices].sort((a, b) => a.date.localeCompare(b.date));

  // Exclude current index prices from the computation inputs to prevent self-referencing
  const stockPrices = sortedAllPrices.filter(p => !INDEX_CONFIGS.some(idx => idx.id === p.securityId));

  INDEX_CONFIGS.forEach(idx => {
    const constituents = new Set(idx.constituentIds);
    // Find all prices of constituents
    const exchangePrices = stockPrices.filter(p => constituents.has(p.securityId));
    if (exchangePrices.length === 0) {
      console.log(`[${idx.id}] No prices found for constituents. Skipping calculation.`);
      return;
    }

    // Get sorted list of unique dates
    const uniqueDates = Array.from(new Set(exchangePrices.map(p => p.date))).sort();
    console.log(`[${idx.id}] Computing history across ${uniqueDates.length} sessions...`);

    // Index prices map
    const priceMap = new Map<string, PriceUpdate[]>();
    idx.constituentIds.forEach(secId => {
      const secPrices = exchangePrices.filter(p => p.securityId === secId).sort((a, b) => a.date.localeCompare(b.date));
      priceMap.set(secId, secPrices);
    });

    uniqueDates.forEach((date) => {
      let sum = 0;
      let count = 0;

      idx.constituentIds.forEach(secId => {
        const secPrices = priceMap.get(secId) || [];
        // Get the latest price on or before this date
        const priceObj = secPrices.filter(p => p.date <= date).slice(-1)[0];
        if (priceObj) {
          sum += priceObj.price;
          count++;
        }
      });

      if (count > 0) {
        // Equal-weighted: simple average of prices * scale factor
        const indexValue = (sum / count) * idx.scale;
        computedIndexPrices.push({
          id: `px-${idx.id}-${date}`,
          securityId: idx.id,
          date,
          price: Number(indexValue.toFixed(2)),
          currency: idx.currency,
          source: 'Index Pre-computation Script'
        });
      }
    });

    console.log(`[${idx.id}] Computed ${uniqueDates.length} index prices. Latest level: ${computedIndexPrices.slice(-1)[0]?.price || 'N/A'}`);
  });

  return computedIndexPrices;
}

// ----------------------------------------------------
// 6. Execution Implementations
// ----------------------------------------------------
async function runLocal() {
  console.log('\n--- Running Local Emulator Setup ---');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');

  console.log('Logging in anonymously to local Auth Emulator...');
  await signInAnonymously(auth);
  console.log('Logged in successfully!');

  // A. Fetch existing securities & prices
  console.log('Fetching standard prices & securities from local emulator...');
  const pricesSnap = await getDocs(collection(db, 'prices'));
  const allPrices = unpackPrices(pricesSnap.docs.map(d => {
    const data = d.data();
    return { ...data, id: d.id };
  }));

  const secSnap = await getDocs(collection(db, 'securities'));
  const existingSecIds = new Set(secSnap.docs.map(d => d.id));

  console.log(`Loaded ${allPrices.length} prices and ${secSnap.size} securities.`);

  // B. Compute index levels
  const computedPrices = computeIndexPrices(allPrices);

  if (computedPrices.length === 0) {
    console.log('No index levels computed. Exiting...');
    return;
  }

  // C. Batch seed index securities if missing
  const secBatch = writeBatch(db);
  let seededSecsCount = 0;
  INDEX_CONFIGS.forEach(idx => {
    if (!existingSecIds.has(idx.id)) {
      const docRef = doc(db, 'securities', idx.id);
      secBatch.set(docRef, {
        id: idx.id,
        companyName: idx.name,
        ticker: idx.id,
        exchangeId: idx.exchangeId,
        sector: 'Market Index',
        status: 'ACTIVE',
        type: 'INDEX'
      });
      seededSecsCount++;
    }
  });

  if (seededSecsCount > 0) {
    await secBatch.commit();
    console.log(`Seeded ${seededSecsCount} missing index securities.`);
  } else {
    console.log('All index securities already exist.');
  }

  // D. Batch upload prices in chunks
  const bucketMap = new Map<string, any>();
  computedPrices.forEach(px => {
    const year = px.date.substring(0, 4);
    const bucketId = `${px.securityId}_${year}`;
    if (!bucketMap.has(bucketId)) {
      bucketMap.set(bucketId, { securityId: px.securityId, year, prices: [] });
    }
    const { id, ...pxData } = px;
    bucketMap.get(bucketId).prices.push(pxData);
  });

  const buckets = Array.from(bucketMap.entries());
  console.log(`Aggregated ${computedPrices.length} prices into ${buckets.length} yearly buckets.`);

  const chunkSize = 500;
  for (let i = 0; i < buckets.length; i += chunkSize) {
    const chunk = buckets.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(([bucketId, bucketData]) => {
      bucketData.prices.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      batch.set(doc(db, 'prices', bucketId), bucketData);
    });
    await batch.commit();
    console.log(`Uploaded local bucket updates: ${i + chunk.length}/${buckets.length}`);
  }

  // E. Purge legacy collections
  console.log('Purging legacy collections "/indices" and "/indexHistory"...');
  const indicesSnap = await getDocs(collection(db, 'indices'));
  if (indicesSnap.size > 0) {
    const batch = writeBatch(db);
    indicesSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`Deleted ${indicesSnap.size} legacy documents from "/indices".`);
  }

  const histSnap = await getDocs(collection(db, 'indexHistory'));
  if (histSnap.size > 0) {
    const batch = writeBatch(db);
    histSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`Deleted ${histSnap.size} legacy documents from "/indexHistory".`);
  }

  console.log('Local Emulator Backfill Completed Successfully!');
}

async function runCloud() {
  console.log('\n--- Running Cloud Production Setup ---');
  // Load token from CLI configstore
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Firebase CLI config not found at ${configPath}. Please run "firebase login" first.`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  let accessToken = config.tokens?.access_token;
  const refreshToken = config.tokens?.refresh_token;

  if (refreshToken) {
    console.log('Refreshing Firebase access token using refresh token...');
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
          client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi'
        })
      });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
          accessToken = tokenData.access_token;
          console.log('Access token refreshed successfully!');
          // Save the fresh token back to config
          config.tokens.access_token = accessToken;
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        }
      } else {
        console.warn('Token refresh response not OK, attempting to use existing access token...', await tokenRes.text());
      }
    } catch (e) {
      console.warn('Failed to refresh token, using existing token:', e);
    }
  }

  if (!accessToken) {
    throw new Error('Access token not found in Firebase CLI config.');
  }

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // A. Fetch existing securities & prices
  console.log(`Connecting to Cloud Firestore for project: ${projectId} via REST API...`);
  const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  
  // Fetch securities
  console.log('Fetching all securities from Cloud...');
  const secRes = await fetch(queryUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'securities' }]
      }
    })
  });
  if (!secRes.ok) {
    const errText = await secRes.text();
    throw new Error(`Fetch securities failed: ${secRes.statusText} (${secRes.status}) - ${errText}`);
  }
  const secData = await secRes.json();
  const securities = secData
    .filter((d: any) => d.document)
    .map((d: any) => parseFirestoreDocument(d.document));
  const existingSecIds = new Set(securities.map((s: any) => s.id));

  console.log(`Securities loaded: ${securities.length}`);

  // Fetch prices
  console.log('Fetching all prices from Cloud...');
  const priceRes = await fetch(queryUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'prices' }]
      }
    })
  });
  if (!priceRes.ok) {
    const errText = await priceRes.text();
    throw new Error(`Fetch prices failed: ${priceRes.statusText} (${priceRes.status}) - ${errText}`);
  }
  const priceData = await priceRes.json();
  const rawDocs = priceData
    .filter((d: any) => d.document)
    .map((d: any) => ({ ...parseFirestoreDocument(d.document), id: d.document.name.split('/').pop() }));
  
  const allPrices = unpackPrices(rawDocs) as PriceUpdate[];

  console.log(`Loaded ${allPrices.length} prices and ${securities.length} securities from Cloud.`);

  // B. Compute index levels
  const computedPrices = computeIndexPrices(allPrices);

  if (computedPrices.length === 0) {
    console.log('No index levels computed. Exiting...');
    return;
  }

  const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;

  // C. Seed index securities
  const secWrites = INDEX_CONFIGS
    .filter(idx => !existingSecIds.has(idx.id))
    .map(idx => {
      const docPath = `projects/${projectId}/databases/(default)/documents/securities/${idx.id}`;
      const fields = {
        id: idx.id,
        companyName: idx.name,
        ticker: idx.id,
        exchangeId: idx.exchangeId,
        sector: 'Market Index',
        status: 'ACTIVE',
        type: 'INDEX'
      };
      const formattedFields: Record<string, any> = {};
      for (const [k, v] of Object.entries(fields)) {
        formattedFields[k] = toFirestoreValue(v);
      }
      return {
        update: {
          name: docPath,
          fields: formattedFields
        }
      };
    });

  if (secWrites.length > 0) {
    console.log(`Uploading ${secWrites.length} index securities to Cloud...`);
    const secCommitRes = await fetch(commitUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ writes: secWrites })
    });
    if (!secCommitRes.ok) {
      throw new Error(`Security seeding failed: ${await secCommitRes.text()}`);
    }
    console.log('Index securities seeded successfully.');
  } else {
    console.log('All index securities already exist on Cloud.');
  }

  // D. Upload index prices in buckets
  const bucketMapCloud = new Map<string, any>();
  computedPrices.forEach(px => {
    const year = px.date.substring(0, 4);
    const bucketId = `${px.securityId}_${year}`;
    if (!bucketMapCloud.has(bucketId)) {
      bucketMapCloud.set(bucketId, { securityId: px.securityId, year, prices: [] });
    }
    const { id, ...pxData } = px;
    bucketMapCloud.get(bucketId).prices.push(pxData);
  });

  const cloudBuckets = Array.from(bucketMapCloud.entries());
  console.log(`Uploading ${cloudBuckets.length} yearly buckets to Cloud...`);

  const chunkSizeCloud = 200;
  for (let i = 0; i < cloudBuckets.length; i += chunkSizeCloud) {
    const chunk = cloudBuckets.slice(i, i + chunkSizeCloud);
    const writes = chunk.map(([bucketId, bucketData]) => {
      bucketData.prices.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const docPath = `projects/${projectId}/databases/(default)/documents/prices/${bucketId}`;
      const formattedFields: Record<string, any> = {};
      for (const [k, v] of Object.entries(bucketData)) {
        formattedFields[k] = toFirestoreValue(v);
      }
      return {
        update: {
          name: docPath,
          fields: formattedFields
        }
      };
    });

    const commitRes = await fetch(commitUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ writes })
    });
    if (!commitRes.ok) {
      throw new Error(`Upload index prices chunk failed: ${await commitRes.text()}`);
    }
    console.log(`Uploaded cloud bucket updates: ${i + chunk.length}/${cloudBuckets.length}`);
  }

  // E. Purge legacy collections
  console.log('Purging legacy collections "/indices" and "/indexHistory" from Cloud...');
  
  // Delete indices
  const indicesDocs = await fetchCloudCollectionDocs('indices', headers, projectId);
  if (indicesDocs.length > 0) {
    console.log(`Deleting ${indicesDocs.length} legacy docs from "/indices" on Cloud...`);
    const deleteWrites = indicesDocs.map(doc => ({ delete: doc.name }));
    const delRes = await fetch(commitUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ writes: deleteWrites })
    });
    if (!delRes.ok) console.warn(`Warning: Failed to delete legacy indices: ${await delRes.text()}`);
    else console.log('Indices collection purged.');
  } else {
    console.log('No legacy indices documents found on Cloud.');
  }

  // Delete indexHistory
  const histDocs = await fetchCloudCollectionDocs('indexHistory', headers, projectId);
  if (histDocs.length > 0) {
    console.log(`Deleting ${histDocs.length} legacy docs from "/indexHistory" on Cloud in chunks of 200...`);
    for (let i = 0; i < histDocs.length; i += chunkSize) {
      const chunk = histDocs.slice(i, i + chunkSize);
      const deleteWrites = chunk.map(doc => ({ delete: doc.name }));
      const delRes = await fetch(commitUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ writes: deleteWrites })
      });
      if (!delRes.ok) console.warn(`Warning: Failed to delete legacy indexHistory chunk: ${await delRes.text()}`);
    }
    console.log('IndexHistory collection purged.');
  } else {
    console.log('No legacy indexHistory documents found on Cloud.');
  }

  console.log('Cloud Production Backfill Completed Successfully!');
}

// ----------------------------------------------------
// 7. Main Runner
// ----------------------------------------------------
async function main() {
  try {
    if (isLocal) {
      await runLocal();
    } else {
      await runCloud();
    }
    process.exit(0);
  } catch (err) {
    console.error('Execution Failed with Error:', err);
    process.exit(1);
  }
}

main();
