export type Role = 'DSI' | 'RSSI' | 'IRS' | 'SSD' | 'BDP' | 'DGS' | 'DIRECTION' | 'ELU' | 'DPO';

export interface AuthUser {
  id: number;
  username: string;
  displayName: string | null;
  roles: Role[];
}

// Taxonomie unifiée avec les fiches réflexes du PCGCN — famille sécurité
// (cyber/malveillance) vs technique/opérationnel (non-cyber) vs transverse.
export type CrisisType =
  | 'cyberattaque' | 'ransomware' | 'ddos' | 'defacement' | 'phishing' | 'compromission_mail' | 'fuite_donnees'
  | 'panne_reseau' | 'panne_applicative' | 'panne_datacenter' | 'panne_electrique' | 'sinistre_salle_serveur' | 'cloud_saas' | 'telephonie'
  | 'ecoles' | 'police_municipale' | 'autre';

export type CrisisStatus = 'detection' | 'qualification' | 'cellule' | 'resolution' | 'retex' | 'cloturee';
export type Severity = 'faible' | 'moyenne' | 'haute' | 'critique';

export interface Crisis {
  id: number;
  title: string;
  type: CrisisType;
  status: CrisisStatus;
  severity: Severity;
  description: string | null;
  opened_at: string;
  closed_at: string | null;
  teams_thread_id?: string | null;
  teams_transcript?: string | null;
  teams_imported_at?: string | null;
  ia_analysis?: string | null;
  ia_analysis_model?: string | null;
  ia_analysis_generated_at?: string | null;
  incident_kind?: 'interruption' | 'degradation' | null;
  services_impactes?: string | null;
  notes?: string | null;
}

export interface CrisisMailboxFinding { severity: string; title: string; description: string }

export interface CrisisMailbox {
  id: number;
  crisis_id: number;
  email: string;
  verdict: string | null;
  score: number | null;
  findings: CrisisMailboxFinding[] | null;
  ai_analysis: string | null;
  ai_analysis_model: string | null;
  ai_analysis_at: string | null;
  source: 'boite_compromise' | 'surveillance' | null;
  fetch_error: string | null;
  fetched_at: string | null;
  created_at: string;
}

export interface DashboardHistorique {
  totalCrises: number;
  closedCrises: number;
  avgResolutionHours: number | null;
  crisesByType: { type: string; count: number }[];
  crisesByFamily: { key: string; label: string; count: number }[];
  crisesByYear: { year: number; count: number }[];
}

export interface TeamsThreadResult {
  id: string;
  date: string;
  auteur: string | null;
  sujet: string;
}

export interface CrisisEvent {
  id: number;
  crisis_id: number;
  content: string;
  event_type: string;
  created_at: string;
  source?: 'manuel' | 'ia';
}

export interface CrisisDecision {
  id: number;
  crisis_id: number;
  title: string;
  description: string | null;
  status: 'a_faire' | 'en_cours' | 'fait' | 'abandonnee';
  due_at: string | null;
  created_at?: string;
  owner_label?: string | null;
  owner_display_name?: string | null;
  owner_username?: string | null;
  horizon?: 'court_terme' | 'moyen_long_terme';
  source?: 'manuel' | 'ia';
  acknowledged_at?: string | null;
  acknowledged_by?: number | null;
  acknowledged_by_display_name?: string | null;
  acknowledged_by_username?: string | null;
  acknowledgment_comment?: string | null;
  crisis_title?: string;
  crisis_status?: CrisisStatus;
}

export interface CrisisDocument {
  id: number;
  crisis_id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface CrisisCommunication {
  id: number;
  crisis_id: number;
  channel: 'mail' | 'sms' | 'interne';
  recipients: string;
  subject: string | null;
  content: string;
  status: 'brouillon' | 'envoye' | 'echec';
  direction?: 'interne' | 'externe';
  created_at?: string;
}

export interface PcaActivity {
  id: number;
  service_name: string;
  direction: string | null;
  description: string | null;
  rto_hours: number | null;
  rpo_hours: number | null;
  degraded_mode: string | null;
  dependencies: string | null;
  criticality: 'faible' | 'moyenne' | 'haute' | 'vitale';
}

export interface PraProcedure {
  id: number;
  pca_activity_id: number | null;
  title: string;
  steps: string;
  last_tested_at: string | null;
  test_result: string | null;
}

// --- PCGCN ------------------------------------------------------------------
export type PcgcnSectionCode =
  | 'gouvernance' | 'niveaux_de_crise' | 'roles' | 'pca' | 'pra'
  | 'communication' | 'juridique' | 'annexes';

export interface PcgcnSection {
  id: number;
  code: PcgcnSectionCode;
  title: string;
  content: string | null;
  updated_at: string;
}

export interface PcgcnFiche {
  id: number;
  type_code: string;
  title: string;
  declencheurs: string | null;
  premiers_reflexes: string | null;
  procedure: string | null;
  contacts_cles: string | null;
  updated_at: string;
}

export interface PcgcnContact {
  id: number;
  source: 'manuel' | 'studiorh' | 'hubdsi';
  groupe: 'dsi' | 'autre';
  agent_ref: string | null;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  direction: string | null;
  telephone_pro: string | null;
  telephone_astreinte: string | null;
  email: string | null;
  role_crise: string | null;
  notes: string | null;
}

export interface PcgcnExterne {
  id: number;
  category: 'prestataire' | 'organisme';
  nom: string;
  contact_nom: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  description: string | null;
}

export interface PcgcnDocument {
  id: number;
  owner_type: 'section' | 'fiche' | 'externe';
  owner_id: number;
  original_name: string;
  size_bytes: number;
  created_at: string;
}
