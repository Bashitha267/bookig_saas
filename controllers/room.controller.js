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

async function listRooms(req, res) {
  try {
    const { ownerId, role, propertyId } = await resolveOwnerContext(req);
    const requestedPropertyId = req.query.propertyId ? Number(req.query.propertyId) : null;
    const scopePropertyId = role === 'staff' ? propertyId : requestedPropertyId || propertyId;
    let sql = `
      SELECT r.*, p.name AS propertyName
      FROM room r
      LEFT JOIN property p ON r.propertyId = p.id
    `;
    const params = [];
    if (ownerId) {
      sql += ' WHERE r.ownerId = ?';
      params.push(ownerId);
      if (scopePropertyId) {
        sql += ' AND r.propertyId = ?';
        params.push(scopePropertyId);
      }
    } else if (scopePropertyId) {
      sql += ' WHERE r.propertyId = ?';
      params.push(scopePropertyId);
    }
    sql += ' ORDER BY r.id DESC';
    const rows = await db.query(sql, params);
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load rooms', error: error.message });
  }
}

async function getRoom(req, res) {
  const { id } = req.params;
  try {
    const { ownerId } = await resolveOwnerContext(req);
    let sql = `
      SELECT r.*, p.name AS propertyName
      FROM room r
      LEFT JOIN property p ON r.propertyId = p.id
      WHERE r.id = ?
    `;
    const params = [id];
    if (ownerId) {
      sql += ' AND r.ownerId = ?';
      params.push(ownerId);
    }
    const rows = await db.query(sql, params);
    if (!rows.length) {
      return res.status(404).json({ message: 'Room not found' });
    }
    return res.json({ data: rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load room', error: error.message });
  }
}

async function createRoom(req, res) {
  const {
    propertyId,
    roomNumber,
    roomType,
    floor,
    capacityAdults,
    capacityChildren,
    price,
    status,
  } = req.body;

  if (!propertyId || !roomNumber || !roomType) {
    return res.status(400).json({ message: 'propertyId, roomNumber, roomType are required' });
  }

  try {
    const { ownerId, role } = await resolveOwnerContext(req);
    const propertyRows = await db.query('SELECT id, ownerId FROM property WHERE id = ? LIMIT 1', [propertyId]);
    const property = propertyRows.length ? propertyRows[0] : null;
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    if (ownerId && property.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Property does not belong to your hotel' });
    }

    const insertOwnerId = role === 'admin' ? property.ownerId : ownerId;
    if (!insertOwnerId) {
      return res.status(400).json({ message: 'Owner context is required for room' });
    }

    const result = await db.execute(
      `INSERT INTO room
        (propertyId, ownerId, roomNumber, roomType, floor, capacityAdults, capacityChildren, price, status, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        propertyId,
        insertOwnerId,
        roomNumber,
        roomType,
        floor || null,
        capacityAdults || 1,
        capacityChildren || 0,
        price || 0,
        status || 'available',
      ]
    );

    return res.status(201).json({ message: 'Room created', id: result.insertId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create room', error: error.message });
  }
}

async function updateRoom(req, res) {
  const { id } = req.params;
  try {
    const { ownerId, role } = await resolveOwnerContext(req);
    const rows = await db.query('SELECT id, ownerId FROM room WHERE id = ? LIMIT 1', [id]);
    const room = rows.length ? rows[0] : null;
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    if (ownerId && room.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Room does not belong to your hotel' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'propertyId')) {
      const propertyRows = await db.query('SELECT id, ownerId FROM property WHERE id = ? LIMIT 1', [req.body.propertyId]);
      const property = propertyRows.length ? propertyRows[0] : null;
      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }
      if (ownerId && property.ownerId !== ownerId) {
        return res.status(403).json({ message: 'Property does not belong to your hotel' });
      }
      if (role === 'admin' && room.ownerId !== property.ownerId) {
        return res.status(400).json({ message: 'Property owner must match room owner' });
      }
    }

    const fields = [
      'propertyId',
      'roomNumber',
      'roomType',
      'floor',
      'capacityAdults',
      'capacityChildren',
      'price',
      'status',
    ];
    const { updates, params } = buildUpdate(fields, req.body);
    if (!updates.length) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const sql = `UPDATE room SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`;
    params.push(id);
    await db.execute(sql, params);

    return res.json({ message: 'Room updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update room', error: error.message });
  }
}

async function deleteRoom(req, res) {
  const { id } = req.params;
  try {
    const { ownerId } = await resolveOwnerContext(req);
    let sql = 'DELETE FROM room WHERE id = ?';
    const params = [id];
    if (ownerId) {
      sql += ' AND ownerId = ?';
      params.push(ownerId);
    }
    const result = await db.execute(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Room not found' });
    }
    return res.json({ message: 'Room deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete room', error: error.message });
  }
}

module.exports = {
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
};
