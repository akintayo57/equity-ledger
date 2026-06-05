/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth, onAuthStateChanged } from './firebase';
import { Login } from './components/Login';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './store';
import { Layout } from './components/Layout';
import { Portfolio } from './screens/Portfolio';
import { HoldingDetail } from './screens/HoldingDetail';
import { DataSettings } from './screens/DataSettings';
import { Markets } from './screens/Markets';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // In local mode, automatically sign in anonymously if there's no user session
    if (import.meta.env.VITE_APP_ENV === 'local') {
      const unsubscribe = onAuthStateChanged(auth, (usr) => {
        if (!usr) {
          import('firebase/auth').then(({ signInAnonymously }) => {
            signInAnonymously(auth).catch((err) => {
              console.error('Failed local auto-login:', err);
              setInitializing(false);
            });
          });
        } else {
          setUser(usr);
          setInitializing(false);
        }
      });
      return unsubscribe;
    }

    // Cloud environments (Google Auth)
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm animate-pulse font-semibold">Initializing Harbour Finance...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <StoreProvider user={user}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout user={user} />}>
            <Route index element={<Markets />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="holdings/:id" element={<HoldingDetail />} />
            <Route path="settings" element={<DataSettings />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}

