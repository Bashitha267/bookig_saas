const db = require('../lib/db');
const { resolveOwnerContext } = require('../lib/ownership');

function buildUpdate(fields, body) {
  const updates = [];
  const params = [];
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates.push(`\`${field}\` = ?`);
      params.push(body[field]);
    }
  });
  return { updates, params };
}

async function listProperties(req, res) {
  try {
    const { ownerId } = await resolveOwnerContext(req);
    let sql = 'SELECT * FROM property';
    const params = [];
    if (ownerId) {
      sql += ' WHERE ownerId = ?';
      params.push(ownerId);
    }
    sql += ' ORDER BY id DESC';
    const rows = await db.query(sql, params);
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load properties', error: error.message });
  }
}

async function getProperty(req, res) {
  const { id } = req.params;
  try {
    const { ownerId } = await resolveOwnerContext(req);
    let sql = 'SELECT * FROM property WHERE id = ?';
    const params = [id];
    if (ownerId) {
      sql += ' AND ownerId = ?';
      params.push(ownerId);
    }
    const rows = await db.query(sql, params);
    if (!rows.length) {
      return res.status(404).json({ message: 'Property not found' });
    }
    return res.json({ data: rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load property', error: error.message });
  }
}

async function createProperty(req, res) {
  const { name, address, city, country, phone, email, ownerId: bodyOwnerId } = req.body;

  if (!name || !address) {
    return res.status(400).json({ message: 'name and address are required' });
  }

  try {
    const { ownerId, role } = await resolveOwnerContext(req);
    const insertOwnerId = role === 'admin' ? bodyOwnerId : ownerId;
    if (!insertOwnerId) {
      return res.status(400).json({ message: 'ownerId is required for property' });
    }

    const result = await db.execute(
      `INSERT INTO property
        (ownerId, name, address, city, country, phone, email, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,NOW(),NOW())`,
      [insertOwnerId, name, address, city || null, country || null, phone || null, email || null]
    );

    return res.status(201).json({ message: 'Property created', id: result.insertId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create property', error: error.message });
  }
}

async function updateProperty(req, res) {
  const { id } = req.params;
  try {
    const { ownerId } = await resolveOwnerContext(req);
    let sqlCheck = 'SELECT id, ownerId FROM property WHERE id = ?';
    const paramsCheck = [id];
    if (ownerId) {
      sqlCheck += ' AND ownerId = ?';
      paramsCheck.push(ownerId);
    }
    const rows = await db.query(sqlCheck, paramsCheck);
    if (!rows.length) {
      return res.status(404).json({ message: 'Property not found' });
    }

    const fields = ['name', 'address', 'city', 'country', 'phone', 'email'];
    const { updates, params } = buildUpdate(fields, req.body);
    if (!updates.length) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const sql = `UPDATE property SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`;
    params.push(id);
    await db.execute(sql, params);

    return res.json({ message: 'Property updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update property', error: error.message });
  }
}

async function deleteProperty(req, res) {
  const { id } = req.params;
  try {
    const { ownerId } = await resolveOwnerContext(req);
    let sql = 'DELETE FROM property WHERE id = ?';
    const params = [id];
    if (ownerId) {
      sql += ' AND ownerId = ?';
      params.push(ownerId);
    }
    const result = await db.execute(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Property not found' });
    }
    return res.json({ message: 'Property deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete property', error: error.message });
  }
}

module.exports = {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
};
