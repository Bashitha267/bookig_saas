const db = require('./db');

async function resolveOwnerContext(req) {
  const { userId, role } = req.user || {};
  if (!userId || !role) {
    throw new Error('Missing auth context');
  }

  if (role === 'owner') {
    return { ownerId: userId, role };
  }

  if (role === 'staff') {
    const rows = await db.query('SELECT ownerId FROM `user` WHERE id = ? LIMIT 1', [userId]);
    const ownerId = rows && rows.length ? rows[0].ownerId : null;
    if (!ownerId) {
      throw new Error('Staff owner not found');
    }
    return { ownerId, role };
  }

  return { ownerId: null, role };
}

module.exports = { resolveOwnerContext };
