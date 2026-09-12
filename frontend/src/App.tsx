import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { RoleGuard } from './components/RoleGuard';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Crises } from './pages/Crises';
import { CrisisDetail } from './pages/CrisisDetail';
import { Documentation } from './pages/Documentation';
import { Pca } from './pages/Pca';
import { Pra } from './pages/Pra';
import { Cartographie } from './pages/Cartographie';
import { Communication } from './pages/Communication';
import { Retex } from './pages/Retex';
import { Admin } from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RoleGuard><Layout /></RoleGuard>}>
        <Route index element={<Dashboard />} />
        <Route path="crises" element={<Crises />} />
        <Route path="crises/:id" element={<CrisisDetail />} />
        <Route path="documentation" element={<Documentation />} />
        <Route path="pca" element={<Pca />} />
        <Route path="pra" element={<Pra />} />
        <Route path="cartographie" element={<Cartographie />} />
        <Route path="communication" element={<Communication />} />
        <Route path="retex" element={<Retex />} />
        <Route
          path="admin"
          element={<RoleGuard roles={['DSI', 'RSSI', 'DPO']}><Admin /></RoleGuard>}
        />
      </Route>
    </Routes>
  );
}
