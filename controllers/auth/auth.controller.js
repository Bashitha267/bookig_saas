const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');

function validateBaseFields(body) {
  const required = ['firstName', 'lastName', 'contact', 'whatsapp', 'address', 'password'];
  const missing = required.filter((key) => !body[key]);
  return missing;
}

async function registerOwner(req, res) {
  const { firstName, lastName, nicNumber, contact, whatsapp, address, password } = req.body;

  const missing = validateBaseFields(req.body);
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing fields: ${missing.join(', ')}` });
  }

  try {
    const existing = await prisma.user.findFirst({ where: { contact } });
    if (existing) {
      return res.status(409).json({ message: 'Contact number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        nicNumber,
        contact,
        whatsapp,
        address,
        password: hashedPassword,
        role: 'owner',
      },
    });

    return res.status(201).json({
      message: 'Owner registered successfully',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register owner', error: error.message });
  }
}

async function login(req, res) {
  const { contact, password } = req.body;

  if (!contact || !password) {
    return res.status(400).json({ message: 'contact and password are required' });
  }

  try {
    const user = await prisma.user.findFirst({ where: { contact } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to login', error: error.message });
  }
}

module.exports = {
  registerOwner,
  login,
};
