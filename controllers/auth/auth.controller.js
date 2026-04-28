const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../lib/db');

function validateBaseFields(body) {
  const required = ['firstName', 'lastName', 'username', 'contact', 'whatsapp', 'address', 'password'];
  const missing = required.filter((key) => !body[key]);
  return missing;
}

async function registerOwner(req, res) {
  const {
    firstName,
    lastName,
    username,
    nicNumber,
    contact,
    whatsapp,
    address,
    password,
    propertyName,
    propertyAddress,
    propertyCity,
    propertyCountry,
    propertyPhone,
    propertyEmail,
  } = req.body;

  const missing = validateBaseFields(req.body);
  if (missing.length > 0) {
    return res.status(400).json({ message: `Missing fields: ${missing.join(', ')}` });
  }

  if (!propertyName || !propertyAddress || !propertyPhone) {
    return res.status(400).json({ message: 'propertyName, propertyAddress, propertyPhone are required' });
  }

  try {
    const existing = await db.query('SELECT id FROM `user` WHERE contact = ? OR username = ? LIMIT 1', [contact, username]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ message: 'Contact number or username already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await db.execute(
      'INSERT INTO `user` (firstName,lastName,username,nicNumber,contact,whatsapp,address,password,role,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())',
      [firstName, lastName, username, nicNumber || null, contact, whatsapp, address, hashedPassword, 'owner']
    );
    const userId = userResult.insertId;

    const propertyResult = await db.execute(
      `INSERT INTO property
        (ownerId, name, address, city, country, phone, email, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        userId,
        propertyName,
        propertyAddress,
        propertyCity || null,
        propertyCountry || null,
        propertyPhone,
        propertyEmail || null,
      ]
    );

    const propertyId = propertyResult.insertId;
    await db.execute('UPDATE `user` SET currentPropertyId = ? WHERE id = ?', [propertyId, userId]);
    const user = { id: userId, firstName, lastName, username, role: 'owner' };

    return res.status(201).json({
      message: 'Owner registered successfully',
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        currentPropertyId: propertyId,
      },
      property: {
        id: propertyId,
        name: propertyName,
        address: propertyAddress,
        city: propertyCity || null,
        country: propertyCountry || null,
        phone: propertyPhone,
        email: propertyEmail || null,
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
        propertyId: user.propertyId || null,
        currentPropertyId: user.currentPropertyId || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to login', error: error.message });
  }
}

async function setCurrentProperty(req, res) {
  const { propertyId } = req.body;
  if (!propertyId) {
    return res.status(400).json({ message: 'propertyId is required' });
  }

  try {
    const rows = await db.query('SELECT id, role FROM `user` WHERE id = ? LIMIT 1', [req.user.userId]);
    const user = rows && rows.length ? rows[0] : null;
    if (!user || user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owner can set current property' });
    }

    const propertyRows = await db.query('SELECT id FROM property WHERE id = ? AND ownerId = ? LIMIT 1', [propertyId, user.id]);
    if (!propertyRows.length) {
      return res.status(404).json({ message: 'Property not found' });
    }

    await db.execute('UPDATE `user` SET currentPropertyId = ? WHERE id = ?', [propertyId, user.id]);
    return res.status(200).json({ message: 'Current property updated', currentPropertyId: propertyId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update current property', error: error.message });
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
  setCurrentProperty,
};
