const { db } = require('../../pg_db');

const list = () => db.all(`
  SELECT u.id, u.username, u.display_name, u.email, u.is_local, u.active, u.created_at,
         COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
  FROM pgc.users u
  LEFT JOIN pgc.user_roles ur ON ur.user_id = u.id
  LEFT JOIN pgc.roles r ON r.id = ur.role_id
  GROUP BY u.id
  ORDER BY u.username
`);

const listRoles = () => db.all('SELECT id, code, label FROM pgc.roles ORDER BY code');

const setActive = (id, active) =>
  db.run('UPDATE pgc.users SET active = $1, updated_at = now() WHERE id = $2', [active, id]);

const setRoles = async (userId, roleCodes) => {
  const roles = await db.all('SELECT id, code FROM pgc.roles WHERE code = ANY($1)', [roleCodes]);
  await db.run('DELETE FROM pgc.user_roles WHERE user_id = $1', [userId]);
  for (const role of roles) {
    await db.run('INSERT INTO pgc.user_roles (user_id, role_id) VALUES ($1, $2)', [userId, role.id]);
  }
  return roles.map((r) => r.code);
};

module.exports = { list, listRoles, setActive, setRoles };
