// Exécute les fichiers migrations/NNN_*.sql dans l'ordre, un par un, en les
// enregistrant dans pgc._migrations pour ne jamais rejouer une migration déjà
// appliquée (cf. GUIDE §6 "Migrations versionnées").
const fs = require('fs');
const path = require('path');
// Même règle de résolution que server.js: backend/.env prioritaire, sinon .env racine.
const localEnvPath = path.join(__dirname, '..', '.env');
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
require('dotenv').config({ path: fs.existsSync(localEnvPath) ? localEnvPath : rootEnvPath });
const { pool } = require('../pg_db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS pgc;');
    await client.query(`
      CREATE TABLE IF NOT EXISTS pgc._migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const dir = __dirname;
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query('SELECT 1 FROM pgc._migrations WHERE filename = $1', [file]);
      if (rows.length) {
        console.log(`[migrate] déjà appliquée: ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`[migrate] application: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO pgc._migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('[migrate] terminé.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('[migrate] échec:', err);
  process.exit(1);
});
