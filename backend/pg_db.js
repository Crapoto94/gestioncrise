// Connexion PostgreSQL — cf. GUIDE_NOUVELLE_APP_VILLE.md §2.
// Tous les identifiants proviennent du .env — aucune valeur en dur ici.
// Un schéma dédié (`pgc`) est utilisé pour ne pas entrer en collision avec
// les schémas existants (hub, magapp, glpi, hub_rencontres, ...).
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB || 'ivry_admin',
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || 5432,
});

pool.on('error', (err) => {
  // Une connexion idle qui tombe ne doit jamais planter le process.
  console.error('[DB] erreur pool inattendue', err);
});

async function setupDb() {
  const client = await pool.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS pgc;');
    console.log('[DB] Schéma pgc prêt (les migrations créent les tables — voir `npm run migrate`)');
  } finally {
    client.release();
  }
}

// Petit wrapper pratique (placeholders $1, $2…)
const db = {
  all: (sql, p = []) => pool.query(sql, p).then((r) => r.rows),
  get: (sql, p = []) => pool.query(sql, p).then((r) => r.rows[0]),
  run: (sql, p = []) => pool.query(sql, p).then((r) => ({ rows: r.rows, changes: r.rowCount })),
};

module.exports = { pool, db, setupDb };
