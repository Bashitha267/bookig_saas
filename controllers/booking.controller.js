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

async function listBookings(req, res) {
  try {
    const { ownerId } = await resolveOwnerContext(req);
    let sql = `
      SELECT b.*, r.roomNumber, r.roomType, p.name AS propertyName
      FROM booking b
      LEFT JOIN room r ON b.roomId = r.id
      LEFT JOIN property p ON r.propertyId = p.id
    `;
    const params = [];
    if (ownerId) {
      sql += ' WHERE b.ownerId = ?';
      params.push(ownerId);
    }
    sql += ' ORDER BY b.id DESC';
    const rows = await db.query(sql, params);
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load bookings', error: error.message });
  }
}

async function getBooking(req, res) {
  const { id } = req.params;
  try {
    const { ownerId } = await resolveOwnerContext(req);
    let sql = `
      SELECT b.*, r.roomNumber, r.roomType, p.name AS propertyName
      FROM booking b
      LEFT JOIN room r ON b.roomId = r.id
      LEFT JOIN property p ON r.propertyId = p.id
      WHERE b.id = ?
    `;
    const params = [id];
    if (ownerId) {
      sql += ' AND b.ownerId = ?';
      params.push(ownerId);
    }
    const rows = await db.query(sql, params);
    if (!rows.length) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    return res.json({ data: rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load booking', error: error.message });
  }
}

async function createBooking(req, res) {
  const {
    roomId,
    guestName,
    guestContact,
    guestNic,
    checkInDate,
    checkOutDate,
    adults,
    children,
    status,
    notes,
  } = req.body;

  if (!roomId || !guestName || !guestContact || !checkInDate || !checkOutDate) {
    return res.status(400).json({ message: 'roomId, guestName, guestContact, checkInDate, checkOutDate are required' });
  }

  try {
    const { ownerId, role } = await resolveOwnerContext(req);
    const roomRows = await db.query('SELECT id, ownerId FROM room WHERE id = ? LIMIT 1', [roomId]);
    const room = roomRows.length ? roomRows[0] : null;
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    if (ownerId && room.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Room does not belong to your hotel' });
    }

    const insertOwnerId = role === 'admin' ? room.ownerId : ownerId;
    if (!insertOwnerId) {
      return res.status(400).json({ message: 'Owner context is required for booking' });
    }

    const result = await db.execute(
      `INSERT INTO booking
        (ownerId, roomId, guestName, guestContact, guestNic, checkInDate, checkOutDate, adults, children, status, notes, createdBy, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        insertOwnerId,
        roomId,
        guestName,
        guestContact,
        guestNic || null,
        checkInDate,
        checkOutDate,
        adults || 1,
        children || 0,
        status || 'pending',
        notes || null,
        req.user.userId,
      ]
    );

    return res.status(201).json({ message: 'Booking created', id: result.insertId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create booking', error: error.message });
  }
}

async function updateBooking(req, res) {
  const { id } = req.params;
  try {
    const { ownerId, role } = await resolveOwnerContext(req);
    const rows = await db.query('SELECT id, ownerId FROM booking WHERE id = ? LIMIT 1', [id]);
    const booking = rows.length ? rows[0] : null;
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (ownerId && booking.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Booking does not belong to your hotel' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'roomId')) {
      const roomRows = await db.query('SELECT id, ownerId FROM room WHERE id = ? LIMIT 1', [req.body.roomId]);
      const room = roomRows.length ? roomRows[0] : null;
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }
      if (ownerId && room.ownerId !== ownerId) {
        return res.status(403).json({ message: 'Room does not belong to your hotel' });
      }
      if (role === 'admin' && booking.ownerId !== room.ownerId) {
        return res.status(400).json({ message: 'Room owner must match booking owner' });
      }
    }

    const fields = [
      'roomId',
      'guestName',
      'guestContact',
      'guestNic',
      'checkInDate',
      'checkOutDate',
      'adults',
      'children',
      'status',
      'notes',
    ];
    const { updates, params } = buildUpdate(fields, req.body);
    if (!updates.length) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const sql = `UPDATE booking SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`;
    params.push(id);
    await db.execute(sql, params);

    return res.json({ message: 'Booking updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update booking', error: error.message });
  }
}

async function deleteBooking(req, res) {
  const { id } = req.params;
  try {
    const { ownerId } = await resolveOwnerContext(req);
    let sql = 'DELETE FROM booking WHERE id = ?';
    const params = [id];
    if (ownerId) {
      sql += ' AND ownerId = ?';
      params.push(ownerId);
    }
    const result = await db.execute(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    return res.json({ message: 'Booking deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete booking', error: error.message });
  }
}

module.exports = {
  listBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking,
};
