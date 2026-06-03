import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  connectAuthEmulator,
  onAuthStateChanged as realOnAuthStateChanged,
  signInWithPopup as realSignInWithPopup,
  signInAnonymously as realSignInAnonymously,
  signOut as realSignOut
} from 'firebase/auth';
import { 
  getFirestore, 
  connectFirestoreEmulator,
  collection as realCollection,
  doc as realDoc,
  onSnapshot as realOnSnapshot,
  setDoc as realSetDoc,
  addDoc as realAddDoc,
  deleteDoc as realDeleteDoc,
  updateDoc as realUpdateDoc
} from 'firebase/firestore';
import { initialSecurities, initialPrices, initialFXRates } from './mockData';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const googleAuthProvider = googleProvider; // alias if needed

// Connect to emulators if running in local environment
if (import.meta.env.VITE_APP_ENV === 'local') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
}

// --- MOCK OFFLINE DATABASE & AUTH IMPLEMENTATION ---

const authListeners = new Set<(user: any) => void>();
const dbListeners = new Set<{ path: string; callback: (snap: any) => void }>();

export const isOfflineMode = () => {
  return localStorage.getItem('harbour_auth_mode') === 'offline';
};

// Initial offline user state
let offlineUser: any = null;
if (isOfflineMode()) {
  const saved = localStorage.getItem('harbour_offline_user');
  if (saved) {
    offlineUser = JSON.parse(saved);
  } else {
    offlineUser = {
      uid: 'guest-developer-uid',
      email: 'guest@harbour.finance',
      displayName: 'Guest Developer',
      isAnonymous: true,
      photoURL: null
    };
    localStorage.setItem('harbour_offline_user', JSON.stringify(offlineUser));
  }
}

// Custom Auth Functions
export const onAuthStateChanged = (authInstance: any, callback: (user: any) => void) => {
  if (isOfflineMode()) {
    if (!offlineUser) {
      offlineUser = {
        uid: 'guest-developer-uid',
        email: 'guest@harbour.finance',
        displayName: 'Guest Developer',
        isAnonymous: true,
        photoURL: null
      };
      localStorage.setItem('harbour_offline_user', JSON.stringify(offlineUser));
    }
    setTimeout(() => callback(offlineUser), 0);
    authListeners.add(callback);
    return () => {
      authListeners.delete(callback);
    };
  } else {
    return realOnAuthStateChanged(authInstance, callback);
  }
};

export const signInAnonymously = async (authInstance: any) => {
  if (isOfflineMode()) {
    return { user: offlineUser };
  }
  try {
    const result = await realSignInAnonymously(authInstance);
    return result;
  } catch (err: any) {
    console.warn("Real Firebase sign-in failed, switching to local offline storage:", err);
    localStorage.setItem('harbour_auth_mode', 'offline');
    const mockUser = {
      uid: 'guest-developer-uid',
      email: 'guest@harbour.finance',
      displayName: 'Guest Developer',
      isAnonymous: true,
      photoURL: null
    };
    localStorage.setItem('harbour_offline_user', JSON.stringify(mockUser));
    offlineUser = mockUser;
    
    // Notify auth listeners
    authListeners.forEach(cb => cb(mockUser));
    
    // Reload page to reinitialize app with offline state
    window.location.reload();
    return { user: mockUser };
  }
};

export const signInWithPopup = async (authInstance: any, provider: any) => {
  try {
    return await realSignInWithPopup(authInstance, provider);
  } catch (err: any) {
    console.error("Google login failed:", err);
    throw err;
  }
};

export const signOut = async (authInstance: any) => {
  const wasOffline = isOfflineMode();
  localStorage.removeItem('harbour_auth_mode');
  localStorage.removeItem('harbour_offline_user');
  offlineUser = null;
  
  authListeners.forEach(cb => cb(null));
  
  if (wasOffline) {
    window.location.reload();
    return;
  }
  
  try {
    await realSignOut(authInstance);
  } catch (err) {
    console.warn("Firebase signOut failed:", err);
  }
};

// Helper to get collection from localStorage or seed it if empty
const getMockCollection = (collectionPath: string): any[] => {
  const key = `harbour_data_${collectionPath.replace(/\//g, '_')}`;
  const dataStr = localStorage.getItem(key);
  if (dataStr) {
    return JSON.parse(dataStr);
  }
  
  // Seed default data if empty
  let initialData: any[] = [];
  if (collectionPath === 'exchanges') {
    initialData = [
      { id: 'GASCI', name: 'Guyana Stock Exchange', country: 'Guyana', currency: 'GYD' },
      { id: 'BSE', name: 'Barbados Stock Exchange', country: 'Barbados', currency: 'BBD' },
      { id: 'TTSE', name: 'Trinidad & Tobago Stock Exchange', country: 'Trinidad & Tobago', currency: 'TTD' },
      { id: 'JSE', name: 'Jamaica Stock Exchange', country: 'Jamaica', currency: 'JMD' }
    ];
  } else if (collectionPath === 'securities') {
    initialData = initialSecurities.map(s => {
      // s.exchange is the legacy property name in mockData, map it to exchangeId
      const exchangeId = (s as any).exchange || 'GASCI';
      return {
        id: s.id,
        companyName: s.companyName,
        ticker: s.ticker,
        exchangeId,
        sector: s.sector,
        status: s.status,
        fundamentals: s.fundamentals,
        currency: s.currency
      };
    });
  } else if (collectionPath === 'prices') {
    initialData = initialPrices;
  } else if (collectionPath === 'fxRates') {
    initialData = initialFXRates;
  } else if (collectionPath === 'equityNotes') {
    initialData = [];
  } else if (collectionPath.endsWith('/accounts')) {
    initialData = [
      { id: 'acc-1', brokerName: 'Primary Ledger', country: 'Guyana', baseCurrency: 'GYD' }
    ];
  } else if (collectionPath.endsWith('/transactions')) {
    initialData = [
      {
        id: 'tx-1',
        accountId: 'acc-1',
        securityId: 'sec-1',
        type: 'BUY',
        date: '2026-05-05',
        shares: 100,
        pricePerShare: 800,
        currency: 'GYD',
        fees: 0,
        notes: 'Initial purchase'
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        securityId: 'sec-2',
        type: 'BUY',
        date: '2026-05-10',
        shares: 200,
        pricePerShare: 200,
        currency: 'GYD',
        fees: 0,
        notes: 'Demerara Bank purchase'
      },
      {
        id: 'tx-3',
        accountId: 'acc-1',
        securityId: 'sec-1',
        type: 'DIVIDEND',
        date: '2026-05-20',
        shares: 100,
        pricePerShare: 15,
        currency: 'GYD',
        fees: 0,
        notes: 'Q2 Dividend payout'
      }
    ];
  }
  
  localStorage.setItem(key, JSON.stringify(initialData));
  return initialData;
};

const getMockDoc = (docPath: string): any => {
  const key = `harbour_data_${docPath.replace(/\//g, '_')}`;
  const dataStr = localStorage.getItem(key);
  if (dataStr) {
    return JSON.parse(dataStr);
  }
  if (docPath.endsWith('/watchlist/default')) {
    const defaultWatchlist = { securityIds: ['sec-1', 'sec-3', 'sec-6'] };
    localStorage.setItem(key, JSON.stringify(defaultWatchlist));
    return defaultWatchlist;
  }
  return null;
};

const saveMockCollection = (collectionPath: string, data: any[]) => {
  const key = `harbour_data_${collectionPath.replace(/\//g, '_')}`;
  localStorage.setItem(key, JSON.stringify(data));
  notifyListeners(collectionPath);
};

const saveMockDoc = (docPath: string, data: any) => {
  const key = `harbour_data_${docPath.replace(/\//g, '_')}`;
  localStorage.setItem(key, JSON.stringify(data));
  notifyListeners(docPath);
};

const notifyListeners = (changedPath: string) => {
  dbListeners.forEach(listener => {
    if (listener.path === changedPath || changedPath.startsWith(listener.path)) {
      const snap = getSnapshotForPath(listener.path);
      listener.callback(snap);
    }
  });
};

const getSnapshotForPath = (path: string) => {
  const isDoc = path.split('/').length % 2 === 0;
  if (isDoc) {
    const data = getMockDoc(path);
    return {
      exists: () => data !== null,
      data: () => data,
      id: path.split('/').pop() || ''
    };
  } else {
    const items = getMockCollection(path);
    return {
      docs: items.map(item => ({
        id: item.id || '',
        data: () => item
      }))
    };
  }
};

// Custom Firestore Functions
export const collection = (dbInstance: any, ...paths: string[]) => {
  if (isOfflineMode()) {
    return { path: paths.join('/'), type: 'collection' };
  } else {
    return (realCollection as any)(dbInstance, ...paths);
  }
};

export const doc = (dbInstance: any, ...paths: string[]) => {
  if (isOfflineMode()) {
    return { path: paths.join('/'), type: 'doc' };
  } else {
    return (realDoc as any)(dbInstance, ...paths);
  }
};

export const onSnapshot = (target: any, callback: (snap: any) => void, errorCallback?: (err: any) => void) => {
  if (isOfflineMode()) {
    const listener = { path: target.path, callback };
    dbListeners.add(listener);
    
    setTimeout(() => {
      try {
        const snap = getSnapshotForPath(target.path);
        callback(snap);
      } catch (err) {
        if (errorCallback) errorCallback(err);
      }
    }, 0);
    
    return () => {
      dbListeners.delete(listener);
    };
  } else {
    return realOnSnapshot(target, callback, errorCallback);
  }
};

export const addDoc = async (collectionRef: any, data: any) => {
  if (isOfflineMode()) {
    const items = getMockCollection(collectionRef.path);
    const newId = 'doc_' + Math.random().toString(36).substr(2, 9);
    const newItem = { ...data, id: newId };
    items.push(newItem);
    saveMockCollection(collectionRef.path, items);
    return { id: newId };
  } else {
    return realAddDoc(collectionRef, data);
  }
};

export const setDoc = async (docRef: any, data: any) => {
  if (isOfflineMode()) {
    const pathParts = docRef.path.split('/');
    if (pathParts.length % 2 === 0) {
      const id = pathParts.pop();
      const parentCollectionPath = pathParts.join('/');
      
      if (docRef.path.endsWith('/watchlist/default')) {
        saveMockDoc(docRef.path, data);
      } else {
        const items = getMockCollection(parentCollectionPath);
        const idx = items.findIndex(item => item.id === id);
        if (idx >= 0) {
          items[idx] = { ...data, id };
        } else {
          items.push({ ...data, id });
        }
        saveMockCollection(parentCollectionPath, items);
      }
    } else {
      console.error("Invalid docRef path for setDoc:", docRef.path);
    }
  } else {
    return realSetDoc(docRef, data);
  }
};

export const updateDoc = async (docRef: any, data: any) => {
  if (isOfflineMode()) {
    const pathParts = docRef.path.split('/');
    const id = pathParts.pop();
    const parentCollectionPath = pathParts.join('/');
    
    if (docRef.path.endsWith('/watchlist/default')) {
      const current = getMockDoc(docRef.path) || {};
      const updated = { ...current, ...data };
      saveMockDoc(docRef.path, updated);
    } else {
      const items = getMockCollection(parentCollectionPath);
      const idx = items.findIndex(item => item.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...data };
        saveMockCollection(parentCollectionPath, items);
      } else {
        console.warn(`Doc not found for updateDoc: ${docRef.path}`);
      }
    }
  } else {
    return realUpdateDoc(docRef, data);
  }
};

export const deleteDoc = async (docRef: any) => {
  if (isOfflineMode()) {
    const pathParts = docRef.path.split('/');
    const id = pathParts.pop();
    const parentCollectionPath = pathParts.join('/');
    
    if (docRef.path.endsWith('/watchlist/default')) {
      localStorage.removeItem(`harbour_data_${docRef.path.replace(/\//g, '_')}`);
      notifyListeners(docRef.path);
    } else {
      const items = getMockCollection(parentCollectionPath);
      const filtered = items.filter(item => item.id !== id);
      saveMockCollection(parentCollectionPath, filtered);
    }
  } else {
    return realDeleteDoc(docRef);
  }
};
