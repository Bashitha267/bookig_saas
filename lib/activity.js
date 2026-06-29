const db = require('./db');

async function logStaffActivity(userId, role, action, details) {
  if (role !== 'staff') return;
  try {
    const rows = await db.query('SELECT ownerId FROM `user` WHERE id = ? LIMIT 1', [userId]);
    const user = rows && rows.length ? rows[0] : null;
    if (user && user.ownerId) {
      await db.execute(
        'INSERT INTO staff_activity (ownerId, staffId, action, details, createdAt) VALUES (?, ?, ?, ?, NOW(3))',
        [user.ownerId, userId, action, details]
      );
    }
  } catch (error) {
    console.error('Failed to log staff activity:', error);
  }
}

module.exports = { logStaffActivity };
