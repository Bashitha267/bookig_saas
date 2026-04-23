const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');

async function registerStaff(req, res) {
  const { firstName, lastName, username, nicNumber, contact, whatsapp, address, password } = req.body;

  const required = ['firstName', 'lastName', 'username', 'contact', 'whatsapp', 'address', 'password'];
  const missing = required.filter((key) => !req.body[key]);
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing fields: ${missing.join(', ')}` });
  }

  try {
    const owner = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!owner || owner.role !== 'owner') {
      return res.status(403).json({ message: 'Only owner can register staff' });
    }

    const existing = await prisma.user.findFirst({ where: { OR: [{ contact }, { username }] } });
    if (existing) {
      return res.status(409).json({ message: 'Contact number or username already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const staff = await prisma.user.create({
      data: {
        firstName,
        lastName,
        username,
        nicNumber,
        contact,
        whatsapp,
        address,
        password: hashedPassword,
        role: 'staff',
        ownerId: owner.id,
      },
    });

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
