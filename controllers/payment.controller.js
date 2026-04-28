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

async function listPayments(req, res) {
  try {
    const { ownerId, role, propertyId } = await resolveOwnerContext(req);
    const requestedPropertyId = req.query.propertyId ? Number(req.query.propertyId) : null;
    const scopePropertyId = role === 'staff' ? propertyId : requestedPropertyId || propertyId;
    let sql = `
      SELECT p.*, b.guestName, b.roomId
      FROM payment p
      LEFT JOIN booking b ON p.bookingId = b.id
      LEFT JOIN room r ON b.roomId = r.id
    `;
    const params = [];
    if (ownerId) {
      sql += ' WHERE p.ownerId = ?';
      params.push(ownerId);
      if (scopePropertyId) {
        sql += ' AND r.propertyId = ?';
        params.push(scopePropertyId);
      }
    } else if (scopePropertyId) {
      sql += ' WHERE r.propertyId = ?';
      params.push(scopePropertyId);
    }
    sql += ' ORDER BY p.id DESC';
    const rows = await db.query(sql, params);
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load payments', error: error.message });
  }
}

async function getPayment(req, res) {
  const { id } = req.params;
  try {
    const { ownerId, role, propertyId } = await resolveOwnerContext(req);
    const requestedPropertyId = req.query.propertyId ? Number(req.query.propertyId) : null;
    const scopePropertyId = role === 'staff' ? propertyId : requestedPropertyId || propertyId;
    let sql = `
      SELECT p.*, b.guestName, b.roomId
      FROM payment p
      LEFT JOIN booking b ON p.bookingId = b.id
      LEFT JOIN room r ON b.roomId = r.id
      WHERE p.id = ?
    `;
    const params = [id];
    if (ownerId) {
      sql += ' AND p.ownerId = ?';
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
      return res.status(404).json({ message: 'Payment not found' });
    }
    return res.json({ data: rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load payment', error: error.message });
  }
}

async function createPayment(req, res) {
  const { bookingId, amount, currency, method, status, paidAt } = req.body;
  if (!bookingId || amount === undefined) {
    return res.status(400).json({ message: 'bookingId and amount are required' });
  }

  try {
    const { ownerId, role } = await resolveOwnerContext(req);
    const bookingRows = await db.query('SELECT id, ownerId FROM booking WHERE id = ? LIMIT 1', [bookingId]);
    const booking = bookingRows.length ? bookingRows[0] : null;
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (ownerId && booking.ownerId !== ownerId) {
      return res.status(403).json({ message: 'Booking does not belong to your hotel' });
    }

    const insertOwnerId = role === 'admin' ? booking.ownerId : ownerId;
    if (!insertOwnerId) {
      return res.status(400).json({ message: 'Owner context is required for payment' });
    }

    const result = await db.execute(
      `INSERT INTO payment
        (ownerId, bookingId, amount, currency, method, status, paidAt, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        insertOwnerId,
        bookingId,
        amount,
        currency || 'USD',
        method || 'cash',
        status || 'paid',
        paidAt || null,
      ]
    );

    return res.status(201).json({ message: 'Payment created', id: result.insertId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create payment', error: error.message });
  }
}

async function updatePayment(req, res) {
  const { id } = req.params;
  try {
    const { ownerId } = await resolveOwnerContext(req);
    let sqlCheck = 'SELECT id, ownerId FROM payment WHERE id = ?';
    const paramsCheck = [id];
    if (ownerId) {
      sqlCheck += ' AND ownerId = ?';
      paramsCheck.push(ownerId);
    }
    const rows = await db.query(sqlCheck, paramsCheck);
    if (!rows.length) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const fields = ['amount', 'currency', 'method', 'status', 'paidAt'];
    const { updates, params } = buildUpdate(fields, req.body);
    if (!updates.length) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const sql = `UPDATE payment SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`;
    params.push(id);
    await db.execute(sql, params);

    return res.json({ message: 'Payment updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update payment', error: error.message });
  }
}

async function deletePayment(req, res) {
  const { id } = req.params;
  try {
    const { ownerId } = await resolveOwnerContext(req);
    let sql = 'DELETE FROM payment WHERE id = ?';
    const params = [id];
    if (ownerId) {
      sql += ' AND ownerId = ?';
      params.push(ownerId);
    }
    const result = await db.execute(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    return res.json({ message: 'Payment deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete payment', error: error.message });
  }
}

module.exports = {
  listPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
};
