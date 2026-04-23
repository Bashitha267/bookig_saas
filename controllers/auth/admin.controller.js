const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');

async function createAdmin(req, res) {
  const { firstName, lastName, nicNumber, contact, whatsapp, address, password } = req.body;

  const required = ['firstName', 'lastName', 'contact', 'whatsapp', 'address', 'password'];
  const missing = required.filter((key) => !req.body[key]);
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing fields: ${missing.join(', ')}` });
  }

  try {
    const existing = await prisma.user.findFirst({ where: { contact } });
    if (existing) {
      return res.status(409).json({ message: 'Contact number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = await prisma.user.create({
      data: {
        firstName,
        lastName,
        nicNumber,
        contact,
        whatsapp,
        address,
        password: hashedPassword,
        role: 'admin',
      },
    });

    return res.status(201).json({
      message: 'Admin created successfully',
      admin: {
        id: newAdmin.id,
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
