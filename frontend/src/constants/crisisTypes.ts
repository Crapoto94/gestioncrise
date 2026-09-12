import type { CrisisStatus } from '../types';

// Taxonomie unifiée avec les fiches réflexes du PCGCN (Tome 2) — deux
// familles distinctes : toute crise informatique n'est pas une crise cyber.
// Source unique partagée par Crises.tsx, CrisisDetail.tsx et Dashboard.tsx
// pour éviter les libellés qui divergent d'une page à l'autre.
export const TYPE_LABELS: Record<string, string> = {
  cyberattaque: 'Cyberattaque',
  ransomware: 'Ransomware',
  ddos: 'Déni de service (DDoS)',
  defacement: 'Défacement / réseaux sociaux',
  phishing: 'Phishing',
  compromission_mail: 'Compromission mail',
  fuite_donnees: 'Fuite de données',
  panne_reseau: 'Panne réseau',
  panne_applicative: 'Panne applicative',
  panne_datacenter: 'Panne datacenter',
  panne_electrique: 'Panne électrique',
  sinistre_salle_serveur: 'Sinistre salle serveur',
  cloud_saas: 'Cloud / SaaS',
  telephonie: 'Téléphonie',
  ecoles: 'Écoles',
  police_municipale: 'Police municipale',
  autre: 'Autre',
};

export const STATUS_LABELS: Record<CrisisStatus, string> = {
  detection: 'Détection',
  qualification: 'Qualification',
  cellule: 'Cellule de crise',
  resolution: 'Résolution',
  retex: 'RETEX',
  cloturee: 'Clôturée',
};
