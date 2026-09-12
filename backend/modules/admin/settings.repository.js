const { db } = require('../../pg_db');

const get = (key) => db.get('SELECT * FROM pgc.app_settings WHERE setting_key = $1', [key]);

const set = (key, value, userId) =>
  db.get(
    `INSERT INTO pgc.app_settings (setting_key, setting_value, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING *`,
    [key, value, userId]
  );

module.exports = { get, set };
