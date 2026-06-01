/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
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
