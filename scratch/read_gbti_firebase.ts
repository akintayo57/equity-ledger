import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

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
const auth = getAuth(app);

async function main() {
  console.log(`Connecting to online Firestore project: ${process.env.VITE_FIREBASE_PROJECT_ID}...`);
  try {
    console.log('Signing in anonymously...');
    const userCredential = await signInAnonymously(auth);
    console.log('Signed in successfully with UID:', userCredential.user.uid);

    console.log('\nFetching GBTI from securities collection...');
    const gbtiDocRef = doc(db, 'securities', 'sec-1');
    const gbtiDocSnap = await getDoc(gbtiDocRef);
    if (gbtiDocSnap.exists()) {
      console.log('GBTI Security Document Data:');
      console.log(JSON.stringify(gbtiDocSnap.data(), null, 2));
    } else {
      console.log('GBTI Security Document (sec-1) does not exist.');
    }

    console.log('\nFetching prices for GBTI (sec-1) from prices collection...');
    const pricesRef = collection(db, 'prices');
    const pricesQuery = query(pricesRef, where('securityId', '==', 'sec-1'));
    const pricesSnap = await getDocs(pricesQuery);
    console.log(`Found ${pricesSnap.size} price records.`);
    
    // Sort prices by date ascending/descending
    const sortedPrices = pricesSnap.docs
      .map(d => d.data())
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
      
    console.log(JSON.stringify(sortedPrices, null, 2));

  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
