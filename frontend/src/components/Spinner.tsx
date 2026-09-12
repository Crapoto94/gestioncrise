import React from 'react';
import { Loader2 } from 'lucide-react';

/** Petite animation d'attente réutilisable (génération IA, chargement…). */
export function Spinner({ size = 14, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}
