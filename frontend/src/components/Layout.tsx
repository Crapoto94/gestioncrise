import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, FileText, ShieldCheck, LifeBuoy,
  Map, Send, ClipboardList, Settings, LogOut, BookOpen, CheckSquare, Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Les 9 menus de 07_UI_UX_ECRANS.md + PCGCN (plan communal de gestion de
// crise numérique, demandé en complément des specs initiales) + Décisions
// (vue transverse à toutes les crises, suivi/acquittement) + Crises en cours
// (analyse IA temps réel des crises ouvertes).
const MENU = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/crises', label: 'Crises', icon: AlertTriangle },
  { to: '/crises-en-cours', label: 'Crises en cours', icon: Radio },
  { to: '/decisions', label: 'Décisions', icon: CheckSquare },
  { to: '/pcgcn', label: 'PCGCN', icon: BookOpen },
  { to: '/documentation', label: 'Documentation', icon: FileText },
  { to: '/pca', label: 'PCA', icon: ShieldCheck },
  { to: '/pra', label: 'PRA', icon: LifeBuoy },
  { to: '/cartographie', label: 'Cartographie', icon: Map },
  { to: '/communication', label: 'Communication', icon: Send },
  { to: '/retex', label: 'RETEX', icon: ClipboardList },
  { to: '/admin', label: 'Admin', icon: Settings, roles: ['DSI', 'RSSI', 'DPO'] },
];

export function Layout() {
  const { user, hasRole, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-ville-dark text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-white/10">
          <div className="bg-white rounded p-2 inline-block">
            <img src="/logo-ivry.jpg" alt="Ville d'Ivry-sur-Seine" className="h-8 w-auto" />
          </div>
          <div className="text-lg font-semibold mt-2">PGC — Gestion de Crise</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {MENU.filter((item) => !item.roles || hasRole(...item.roles)).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  isActive ? 'bg-white/15 font-medium' : 'hover:bg-white/10 text-white/85'
                }`
              }
            >
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 text-sm">
          <div className="mb-2 text-white/80">{user?.displayName || user?.username}</div>
          <div className="mb-2 flex flex-wrap gap-1">
            {user?.roles.map((r) => (
              <span key={r} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">{r}</span>
            ))}
          </div>
          <button onClick={logout} className="flex items-center gap-1 text-white/70 hover:text-white">
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
