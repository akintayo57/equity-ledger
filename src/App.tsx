/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { Login } from './components/Login';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './store';
import { Layout } from './components/Layout';
import { Dashboard } from './screens/Dashboard';
import { Holdings } from './screens/Holdings';
import { HoldingDetail } from './screens/HoldingDetail';
import { Performance } from './screens/Performance';
import { Transactions } from './screens/Transactions';
import { DataSettings } from './screens/DataSettings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
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
            <Route index element={<Dashboard />} />
            <Route path="holdings" element={<Holdings />} />
            <Route path="holdings/:id" element={<HoldingDetail />} />
            <Route path="performance" element={<Performance />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="settings" element={<DataSettings />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  );
}

