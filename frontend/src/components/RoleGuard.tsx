import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Protège une route: redirige vers /login si non authentifié, ou affiche un
 * message si le rôle ne correspond pas (cf. modèle de rôles 00_VISION_PRODUIT.md). */
export function RoleGuard({ roles, children }: { roles?: string[]; children: React.ReactNode }) {
  const { user, loading, hasRole } = useAuth();

  if (loading) return <div className="p-8 text-gray-500">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && roles.length && !hasRole(...roles)) {
    return <div className="p-8 text-red-600">Accès réservé aux rôles : {roles.join(', ')}.</div>;
  }
  return <>{children}</>;
}
