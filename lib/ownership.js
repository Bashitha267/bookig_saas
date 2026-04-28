const db = require('./db');

async function resolveOwnerContext(req) {
  const { userId, role } = req.user || {};
  if (!userId || !role) {
    throw new Error('Missing auth context');
  }

  const rows = await db.query(
    'SELECT id, role, ownerId, propertyId, currentPropertyId FROM `user` WHERE id = ? LIMIT 1',
    [userId]
  );
  const user = rows && rows.length ? rows[0] : null;
  if (!user) {
    throw new Error('User not found');
  }

  if (role === 'owner') {
    return { ownerId: userId, role, propertyId: user.currentPropertyId || null, userId };
  }

  if (role === 'staff') {
    if (!user.ownerId) {
      throw new Error('Staff owner not found');
    }
    return { ownerId: user.ownerId, role, propertyId: user.propertyId || null, userId };
  }

  return { ownerId: null, role, propertyId: null, userId };
}

module.exports = { resolveOwnerContext };
