const bcrypt = require('bcryptjs');
const db = require('../../lib/db');

async function registerStaff(req, res) {
  const { firstName, lastName, username, nicNumber, contact, whatsapp, address, password } = req.body;

  const required = ['firstName', 'lastName', 'username', 'contact', 'whatsapp', 'address', 'password'];
  const missing = required.filter((key) => !req.body[key]);
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing fields: ${missing.join(', ')}` });
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.execute(
      'INSERT INTO `user` (firstName,lastName,username,nicNumber,contact,whatsapp,address,password,role,ownerId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),NOW())',
      [firstName, lastName, username, nicNumber || null, contact, whatsapp, address, hashedPassword, 'staff', owner.id]
    );
    const staffId = result.insertId;
    const staff = { id: staffId, firstName, lastName, username, role: 'staff', ownerId: owner.id };

    return res.status(201).json({
      message: 'Staff registered successfully',
      staff: {
        id: staff.id,
        username: staff.username,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role,
        ownerId: staff.ownerId,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register staff', error: error.message });
  }
}

module.exports = {
  registerStaff,
};
