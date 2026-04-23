const bcrypt = require('bcryptjs');


async function createAdmin(req, res) {
  const { firstName, lastName, username, nicNumber, contact, whatsapp, address, password } = req.body;

  const required = ['firstName', 'lastName', 'username', 'contact', 'whatsapp', 'address', 'password'];
  const missing = required.filter((key) => !req.body[key]);
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing fields: ${missing.join(', ')}` });
  }

  try {
    const existing = await db.query('SELECT id FROM `User` WHERE contact = ? OR username = ? LIMIT 1', [contact, username]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ message: 'Contact number or username already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.execute(
      'INSERT INTO `User` (firstName,lastName,username,nicNumber,contact,whatsapp,address,password,role,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())',
      [firstName, lastName, username, nicNumber || null, contact, whatsapp, address, hashedPassword, 'admin']
    );
    const newAdmin = { id: result.insertId, username, firstName, lastName, role: 'admin' };

    return res.status(201).json({
      message: 'Admin created successfully',
      admin: {
        id: newAdmin.id,
        username: newAdmin.username,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create admin', error: error.message });
  }
}

module.exports = {
  createAdmin,
};
