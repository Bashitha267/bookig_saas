const db = require('../lib/db');
const { resolveOwnerContext } = require('../lib/ownership');
const { logStaffActivity } = require('../lib/activity');

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
    const { ownerId, role, propertyId } = await resolveOwnerContext(req);
    const requestedPropertyId = req.query.propertyId ? Number(req.query.propertyId) : null;
    
    // For staff, always lock to their assigned property.
    // For owners, use requested property if provided, otherwise show all (no scope filter).
    const scopePropertyId = role === 'staff' ? propertyId : requestedPropertyId;

    let sql = `
      SELECT b.*, r.roomNumber, r.roomType,
             b.bookedRoomPrice AS roomPrice,
             r.propertyId AS propertyId, p.name AS propertyName
      FROM booking b
      LEFT JOIN room r ON b.roomId = r.id
      LEFT JOIN property p ON r.propertyId = p.id
    `;
    const params = [];
    const conditions = [];

    if (ownerId) {
      conditions.push('b.ownerId = ?');
      params.push(ownerId);
    }

    if (scopePropertyId) {
      conditions.push('r.propertyId = ?');
      params.push(scopePropertyId);
    }

    if (conditions.length) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
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
    const { ownerId, role, propertyId } = await resolveOwnerContext(req);
    const requestedPropertyId = req.query.propertyId ? Number(req.query.propertyId) : null;
    const scopePropertyId = role === 'staff' ? propertyId : requestedPropertyId;
    let sql = `
      SELECT b.*, r.roomNumber, r.roomType,
             b.bookedRoomPrice AS roomPrice,
             r.propertyId AS propertyId, p.name AS propertyName
      FROM booking b
      LEFT JOIN room r ON b.roomId = r.id
      LEFT JOIN property p ON r.propertyId = p.id
      WHERE b.id = ?
    `;
    const params = [id];
    if (ownerId) {
      sql += ' AND b.ownerId = ?';
      params.push(ownerId);
      if (scopePropertyId) {
        sql += ' AND r.propertyId = ?';
        params.push(scopePropertyId);
      }
    } else if (scopePropertyId) {
      sql += ' AND r.propertyId = ?';
      params.push(scopePropertyId);
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
    checkInTime,
    checkOutDate,
    checkOutTime,
    adults,
    children,
    status,
    notes,
    discount,
  } = req.body;

  if (!roomId || !guestName || !guestContact || !checkInDate || !checkOutDate) {
    return res.status(400).json({ message: 'roomId, guestName, guestContact, checkInDate, checkOutDate are required' });
  }

  try {
    const { ownerId, role, propertyId, userId } = await resolveOwnerContext(req);
    // Fetch full room details including current price to snapshot at booking time
    const roomRows = await db.query('SELECT id, ownerId, propertyId, price FROM room WHERE id = ? LIMIT 1', [roomId]);
    const room = roomRows.length ? roomRows[0] : null;
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    if (ownerId && room.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Room does not belong to your hotel' });
    }
    if (role === 'staff' && propertyId && room.propertyId !== propertyId) {
      return res.status(403).json({ message: 'Room does not belong to your property' });
    }

    const insertOwnerId = role === 'admin' ? room.ownerId : ownerId || room.ownerId;
    const createdBy = userId || room.ownerId;

    // Snapshot the room price at booking creation — future room price changes won't affect this booking
    const snapshotPrice = Number(room.price || 0);

    // Default check-in time: 14:00 (2:00 PM), check-out time: 11:00 (11:00 AM)
    const resolvedCheckInTime  = checkInTime  || '14:00:00';
    const resolvedCheckOutTime = checkOutTime || '11:00:00';

    const result = await db.execute(
      `INSERT INTO booking
        (ownerId, roomId, bookedRoomPrice, guestName, guestContact, guestNic, checkInDate, checkInTime, checkOutDate, checkOutTime, adults, children, status, notes, createdBy, discount, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        insertOwnerId,
        roomId,
        snapshotPrice,
        guestName,
        guestContact,
        guestNic || null,
        checkInDate,
        resolvedCheckInTime,
        checkOutDate,
        resolvedCheckOutTime,
        adults || 1,
        children || 0,
        status || 'pending',
        notes || null,
        createdBy,
        discount || 0.00,
      ]
    );

    await logStaffActivity(userId, role, 'Create Booking', `Created booking for guest ${guestName} (ID: ${result.insertId})`);

    return res.status(201).json({ message: 'Booking created', id: result.insertId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create booking', error: error.message });
  }
}

async function updateBooking(req, res) {
  const { id } = req.params;
  try {
    const { ownerId, role, propertyId } = await resolveOwnerContext(req);
    const rows = await db.query('SELECT id, ownerId FROM booking WHERE id = ? LIMIT 1', [id]);
    const booking = rows.length ? rows[0] : null;
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (ownerId && booking.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Booking does not belong to your hotel' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'roomId')) {
      const roomRows = await db.query('SELECT id, ownerId, propertyId FROM room WHERE id = ? LIMIT 1', [req.body.roomId]);
      const room = roomRows.length ? roomRows[0] : null;
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }
      if (ownerId && room.ownerId !== ownerId) {
        return res.status(403).json({ message: 'Room does not belong to your hotel' });
      }
      if (role === 'staff' && propertyId && room.propertyId !== propertyId) {
        return res.status(403).json({ message: 'Room does not belong to your property' });
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
      'checkInTime',
      'checkOutDate',
      'checkOutTime',
      'adults',
      'children',
      'status',
      'notes',
      'expenses',
      'discount',
      'idStatus',
      'idNote',
    ];
    const { updates, params } = buildUpdate(fields, req.body);
    if (!updates.length) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const sql = `UPDATE booking SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`;
    params.push(id);
    await db.execute(sql, params);

    await logStaffActivity(req.user.userId, req.user.role, 'Update Booking', `Updated booking ID: ${id} with status: ${req.body.status || 'N/A'}`);

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
