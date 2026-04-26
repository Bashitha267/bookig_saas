const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../lib/db');

function validateBaseFields(body) {
  const required = ['firstName', 'lastName', 'username', 'contact', 'whatsapp', 'address', 'password'];
  const missing = required.filter((key) => !body[key]);
  return missing;
}

async function registerOwner(req, res) {
  const { firstName, lastName, username, nicNumber, contact, whatsapp, address, password } = req.body;

  const missing = validateBaseFields(req.body);
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing fields: ${missing.join(', ')}` });
  }

  try {
    const existing = await db.query('SELECT id FROM `user` WHERE contact = ? OR username = ? LIMIT 1', [contact, username]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ message: 'Contact number or username already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.execute(
      'INSERT INTO `user` (firstName,lastName,username,nicNumber,contact,whatsapp,address,password,role,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())',
      [firstName, lastName, username, nicNumber || null, contact, whatsapp, address, hashedPassword, 'owner']
    );
    const userId = result.insertId;
    const user = { id: userId, firstName, lastName, username, role: 'owner' };

    return res.status(201).json({
      message: 'Owner registered successfully',
      user: {
        id: user.id,
        username: user.username,
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
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'username and password are required' });
  }

  try {
    const rows = await db.query('SELECT * FROM `user` WHERE username = ? LIMIT 1', [username]);
    const user = rows && rows.length ? rows[0] : null;
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to login', error: error.message });
  }
}

async function logout(req, res) {
  try {
    res.clearCookie('token');
    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to logout', error: error.message });
  }
}

module.exports = {
  registerOwner,
  login,
  logout,
};
