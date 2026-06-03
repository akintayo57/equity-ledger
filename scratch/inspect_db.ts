import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

dotenv.config({ path: '.env.development' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log(`Checking Firestore project: ${process.env.VITE_FIREBASE_PROJECT_ID}...`);
  try {
    const snap = await getDocs(collection(db, 'securities'));
    console.log(`Total securities found: ${snap.size}`);
    
    const countByExchange: Record<string, number> = {};
    snap.forEach(d => {
      const data = d.data();
      const ex = data.exchange || 'unknown';
      countByExchange[ex] = (countByExchange[ex] || 0) + 1;
      console.log(` - [${data.ticker}] ${data.companyName} (${ex})`);
    });
    
    console.log('\nSummary by Exchange:');
    console.log(JSON.stringify(countByExchange, null, 2));
  } catch (err) {
    console.error('Error fetching securities:', err);
  }
}

main();
