const { db } = require('../../pg_db');

const findByUsername = (username) =>
  db.get('SELECT * FROM pgc.users WHERE username = $1', [username]);

const findRolesByUserId = (userId) =>
  db.all(
    `SELECT r.code FROM pgc.roles r
     JOIN pgc.user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1`,
    [userId]
  ).then((rows) => rows.map((r) => r.code));

const createFromAd = (username, displayName, email) =>
  db.get(
    `INSERT INTO pgc.users (username, display_name, email, is_local, active)
     VALUES ($1, $2, $3, false, true)
     ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email
     RETURNING *`,
    [username, displayName, email]
  );

const createLocal = (username, passwordHash, displayName) =>
  db.get(
    `INSERT INTO pgc.users (username, display_name, is_local, password_hash, active)
     VALUES ($1, $2, true, $3, true)
     ON CONFLICT (username) DO NOTHING
     RETURNING *`,
    [username, displayName, passwordHash]
  );

module.exports = { findByUsername, findRolesByUserId, createFromAd, createLocal };
