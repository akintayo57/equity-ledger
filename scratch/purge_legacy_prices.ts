import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  connectFirestoreEmulator, 
  writeBatch, 
  collection,
  getDocs
} from 'firebase/firestore';

const isLocal = process.argv.includes('--local');
const isCloud = process.argv.includes('--cloud');

let projectOverride: string | null = null;
const projectArgIndex = process.argv.indexOf('--project');
if (projectArgIndex !== -1 && projectArgIndex + 1 < process.argv.length) {
  projectOverride = process.argv[projectArgIndex + 1];
}

if (!isLocal && !isCloud) {
  console.error('Error: Please specify either --local or --cloud environment.');
  process.exit(1);
}

const envFile = isLocal ? '.env.workstation' : '.env.development';
console.log(`Loading environment config from ${envFile}...`);
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

const projectId = projectOverride || process.env.VITE_FIREBASE_PROJECT_ID || 'harbour-finance-902b';
const firebaseConfig = {
  projectId: projectId,
};

async function fetchCloudCollectionDocs(collectionName: string, headers: any, projId: string) {
  const queryUrl = `https://firestore.googleapis.com/v1/projects/${projId}/databases/(default)/documents:runQuery`;
  const res = await fetch(queryUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collectionName }]
      }
    })
  });
  if (!res.ok) throw new Error(`Fetch ${collectionName} failed: ${await res.text()}`);
  const data = await res.json();
  return data.filter((d: any) => d.document).map((d: any) => d.document);
}

async function runLocal() {
  console.log('\n--- Running Local Emulator Purge ---');
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);

  const pricesSnap = await getDocs(collection(db, 'prices'));
  const legacyDocs = pricesSnap.docs.filter(d => {
    const data = d.data();
    return !data.prices || !Array.isArray(data.prices);
  });

  console.log(`Found ${pricesSnap.size} total prices docs. ${legacyDocs.length} are legacy.`);

  if (legacyDocs.length === 0) {
    console.log('No legacy documents to delete. Exiting...');
    return;
  }

  const chunkSize = 500;
  for (let i = 0; i < legacyDocs.length; i += chunkSize) {
    const chunk = legacyDocs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`Deleted chunk ${i + chunk.length}/${legacyDocs.length}`);
  }
  
  console.log('Local purge completed.');
}

async function runCloud() {
  console.log('\n--- Running Cloud Purge ---');
  const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Firebase CLI config not found at ${configPath}. Please run "firebase login" first.`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  let accessToken = config.tokens?.access_token;
  const refreshToken = config.tokens?.refresh_token;

  if (refreshToken) {
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
          config.tokens.access_token = accessToken;
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        }
      }
    } catch (e) {
      console.warn('Failed to refresh token, using existing token:', e);
    }
  }

  if (!accessToken) throw new Error('Access token not found in Firebase CLI config.');

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const rawDocs = await fetchCloudCollectionDocs('prices', headers, projectId);
  const legacyDocs = rawDocs.filter((d: any) => {
    // Check if fields contain "prices" array
    return !d.fields || !d.fields.prices || !d.fields.prices.arrayValue;
  });

  console.log(`Found ${rawDocs.length} total prices docs. ${legacyDocs.length} are legacy.`);

  if (legacyDocs.length === 0) {
    console.log('No legacy documents to delete. Exiting...');
    return;
  }

  const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
  const chunkSize = 500;
  
  for (let i = 0; i < legacyDocs.length; i += chunkSize) {
    const chunk = legacyDocs.slice(i, i + chunkSize);
    const writes = chunk.map((d: any) => ({ delete: d.name }));
    const res = await fetch(commitUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ writes })
    });
    if (!res.ok) throw new Error(`Batch delete failed: ${await res.text()}`);
    console.log(`Deleted chunk ${i + chunk.length}/${legacyDocs.length}`);
  }

  console.log('Cloud purge completed.');
}

async function main() {
  try {
    if (isLocal) {
      await runLocal();
    } else if (isCloud) {
      await runCloud();
    }
  } catch (err) {
    console.error('Error during purge:', err);
    process.exit(1);
  }
}

main();
