const bcrypt = require('bcryptjs');
const db = require('../../lib/db');

async function registerStaff(req, res) {
  const { firstName, lastName, username, nicNumber, contact, whatsapp, address, password, propertyIds } = req.body;

  const required = ['firstName', 'lastName', 'username', 'contact', 'whatsapp', 'address', 'password', 'propertyIds'];
  const missing = required.filter((key) => !req.body[key]);
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing fields: ${missing.join(', ')}` });
  }

  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    return res.status(400).json({ message: 'propertyIds must be a non-empty array' });
  }

  try {
    const ownerRows = await db.query('SELECT * FROM `user` WHERE id = ? LIMIT 1', [req.user.userId]);
    const owner = ownerRows && ownerRows.length ? ownerRows[0] : null;
    if (!owner || owner.role !== 'owner') {
      return res.status(403).json({ message: 'Only owner can register staff' });
    }

    const existing = await db.query('SELECT id FROM `user` WHERE contact = ? OR username = ? LIMIT 1', [contact, username]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ message: 'Contact number or username already registered' });
    }

    // Verify all properties belong to the owner
    const placeholders = propertyIds.map(() => '?').join(',');
    const propertyRows = await db.query(
      `SELECT id FROM property WHERE id IN (${placeholders}) AND ownerId = ?`,
      [...propertyIds, owner.id]
    );
    if (propertyRows.length !== propertyIds.length) {
      return res.status(404).json({ message: 'One or more selected properties not found or unauthorized' });
    }

    const primaryPropertyId = propertyIds[0];
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.execute(
      'INSERT INTO `user` (firstName,lastName,username,nicNumber,contact,whatsapp,address,password,role,ownerId,propertyId,currentPropertyId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())',
      [firstName, lastName, username, nicNumber || null, contact, whatsapp, address, hashedPassword, 'staff', owner.id, primaryPropertyId, primaryPropertyId]
    );
    const staffId = result.insertId;

    // Save multi-property mappings
    for (const propId of propertyIds) {
      await db.execute(
        'INSERT INTO staff_properties (staffId, propertyId) VALUES (?, ?)',
        [staffId, propId]
      );
    }

    return res.status(201).json({
      message: 'Staff registered successfully',
      staff: {
        id: staffId,
        username,
        firstName,
        lastName,
        role: 'staff',
        ownerId: owner.id,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register staff', error: error.message });
  }
}

async function listStaff(req, res) {
  try {
    const ownerId = req.user.userId;
    const rows = await db.query(
      `SELECT id, firstName, lastName, username, nicNumber, contact, whatsapp, address, status, role, createdAt
       FROM \`user\`
       WHERE ownerId = ? AND role = 'staff'
       ORDER BY id DESC`,
      [ownerId]
    );

    // Fetch properties linked to each staff member
    for (const staff of rows) {
      const propRows = await db.query(
        'SELECT propertyId FROM staff_properties WHERE staffId = ?',
        [staff.id]
      );
      staff.propertyIds = propRows.map(r => r.propertyId);
    }

    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list staff', error: error.message });
  }
}

module.exports = {
  registerStaff,
  listStaff,
};
