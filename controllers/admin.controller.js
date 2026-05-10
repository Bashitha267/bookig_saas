const bcrypt = require('bcryptjs');
const db = require('../lib/db');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildDateRange(query) {
  const { year, month, day, startDate, endDate } = query;
  if (year) {
    const y = Number.parseInt(year, 10);
    if (Number.isNaN(y) || y < 1970) {
      return { error: 'Invalid year' };
    }
    if (month) {
      const m = Number.parseInt(month, 10);
      if (Number.isNaN(m) || m < 1 || m > 12) {
        return { error: 'Invalid month' };
      }
      if (day) {
        const d = Number.parseInt(day, 10);
        const last = new Date(y, m, 0).getDate();
        if (Number.isNaN(d) || d < 1 || d > last) {
          return { error: 'Invalid day' };
        }
        const dateValue = `${y}-${pad2(m)}-${pad2(d)}`;
        return { startDate: dateValue, endDate: dateValue };
      }
      const lastDay = new Date(y, m, 0).getDate();
      return {
        startDate: `${y}-${pad2(m)}-01`,
        endDate: `${y}-${pad2(m)}-${pad2(lastDay)}`,
      };
    }
    return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
  }

  if (startDate && !isDateString(startDate)) {
    return { error: 'Invalid startDate' };
  }
  if (endDate && !isDateString(endDate)) {
    return { error: 'Invalid endDate' };
  }

  return { startDate: startDate || null, endDate: endDate || null };
}

function applyDateOverlap(sqlParts, params, tableAlias, startDate, endDate) {
  if (startDate && endDate) {
    sqlParts.push(`AND ${tableAlias}.periodStart <= ? AND ${tableAlias}.periodEnd >= ?`);
    params.push(endDate, startDate);
  } else if (startDate) {
    sqlParts.push(`AND ${tableAlias}.periodEnd >= ?`);
    params.push(startDate);
  } else if (endDate) {
    sqlParts.push(`AND ${tableAlias}.periodStart <= ?`);
    params.push(endDate);
  }
}

function applyDateRange(sqlParts, params, fieldName, startDate, endDate) {
  if (startDate) {
    sqlParts.push(`AND ${fieldName} >= ?`);
    params.push(startDate);
  }
  if (endDate) {
    sqlParts.push(`AND ${fieldName} <= ?`);
    params.push(endDate);
  }
}

async function listOwners(req, res) {
  try {
    const { q, status } = req.query;
    const sqlParts = [
      "SELECT u.id, u.firstName, u.lastName, u.username, u.contact, u.address, u.email, u.status, u.createdAt,",
      'COUNT(DISTINCT p.id) AS propertyCount,',
      'COUNT(DISTINCT s.id) AS staffCount,',
      'MAX(ob.status) AS currentBillingStatus,',
      'MAX(ob.amountDue) AS currentAmountDue,',
      'MAX(ob.amountPaid) AS currentAmountPaid',
      'FROM `user` u',
      'LEFT JOIN property p ON p.ownerId = u.id',
      "LEFT JOIN `user` s ON s.ownerId = u.id AND s.role = 'staff'",
      'LEFT JOIN owner_billing ob ON ob.ownerId = u.id AND ob.periodStart <= CURRENT_DATE() AND ob.periodEnd >= CURRENT_DATE()',
      "WHERE u.role = 'owner'",
    ];
    const params = [];

    if (status) {
      sqlParts.push('AND u.status = ?');
      params.push(status);
    }

    if (q) {
      const like = `%${q}%`;
      sqlParts.push('AND (u.firstName LIKE ? OR u.lastName LIKE ? OR u.username LIKE ? OR u.contact LIKE ? OR p.name LIKE ? OR s.firstName LIKE ? OR s.lastName LIKE ?)');
      params.push(like, like, like, like, like, like, like);
    }

    sqlParts.push('GROUP BY u.id ORDER BY u.id DESC');
    const rows = await db.query(sqlParts.join(' '), params);
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load owners', error: error.message });
  }
}

async function getOwner(req, res) {
  const { id } = req.params;
  try {
    const ownerRows = await db.query(
      "SELECT id, firstName, lastName, username, contact, whatsapp, address, email, status, createdAt FROM `user` WHERE id = ? AND role = 'owner' LIMIT 1",
      [id]
    );
    if (!ownerRows.length) {
      return res.status(404).json({ message: 'Owner not found' });
    }

    const properties = await db.query(
      'SELECT id, name, address, city, country, phone, email, status, createdAt FROM property WHERE ownerId = ? ORDER BY id DESC',
      [id]
    );

    // Fetch rooms for each property
    for (const prop of properties) {
      prop.rooms = await db.query(
        'SELECT id, roomNumber, roomType, price, status FROM room WHERE propertyId = ? ORDER BY id DESC',
        [prop.id]
      );
    }
    
    const staff = await db.query(
      "SELECT id, firstName, lastName, username, contact, whatsapp, address, status, propertyId, createdAt FROM `user` WHERE ownerId = ? AND role = 'staff' ORDER BY id DESC",
      [id]
    );

    const billingRows = await db.query(
      'SELECT id, periodStart, periodEnd, amountDue, amountPaid, status FROM owner_billing WHERE ownerId = ? AND periodStart <= CURRENT_DATE() AND periodEnd >= CURRENT_DATE() ORDER BY periodStart DESC LIMIT 1',
      [id]
    );

    return res.json({
      owner: ownerRows[0],
      properties,
      staff,
      currentBilling: billingRows.length ? billingRows[0] : null,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load owner details', error: error.message });
  }
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { username, password, email, status } = req.body;

  if (!username && !password && email === undefined && !status) {
    return res.status(400).json({ message: 'No valid fields to update' });
  }

  if (status && !['active', 'blocked'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    if (username) {
      const existing = await db.query('SELECT id FROM `user` WHERE username = ? AND id <> ? LIMIT 1', [username, id]);
      if (existing.length) {
        return res.status(409).json({ message: 'Username already in use' });
      }
    }

    const updates = [];
    const params = [];

    if (username) {
      updates.push('username = ?');
      params.push(username);
    }

    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email || null);
    }

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (!updates.length) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const sql = `UPDATE \`user\` SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`;
    params.push(id);
    const result = await db.execute(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ message: 'User updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update user', error: error.message });
  }
}

async function updatePropertyStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!['active', 'blocked'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const result = await db.execute('UPDATE property SET status = ?, updatedAt = NOW() WHERE id = ?', [status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Property not found' });
    }
    return res.json({ message: 'Property status updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update property status', error: error.message });
  }
}

async function listOwnerBilling(req, res) {
  try {
    const { ownerId, status, q } = req.query;
    const { startDate, endDate, error } = buildDateRange(req.query);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const sqlParts = [
      'SELECT ob.*, u.firstName, u.lastName, u.username, u.contact',
      'FROM owner_billing ob',
      'JOIN `user` u ON ob.ownerId = u.id',
      "WHERE u.role = 'owner'",
    ];
    const params = [];

    if (ownerId) {
      sqlParts.push('AND ob.ownerId = ?');
      params.push(ownerId);
    }

    if (status) {
      sqlParts.push('AND ob.status = ?');
      params.push(status);
    }

    if (q) {
      const like = `%${q}%`;
      sqlParts.push('AND (u.firstName LIKE ? OR u.lastName LIKE ? OR u.username LIKE ? OR u.contact LIKE ?)');
      params.push(like, like, like, like);
    }

    applyDateOverlap(sqlParts, params, 'ob', startDate, endDate);

    sqlParts.push('ORDER BY ob.periodStart DESC');
    const rows = await db.query(sqlParts.join(' '), params);
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load billing records', error: error.message });
  }
}

async function getOwnerBillingSummary(req, res) {
  try {
    const { ownerId, status, q } = req.query;
    const { startDate, endDate, error } = buildDateRange(req.query);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const sqlParts = [
      'SELECT',
      'COUNT(*) AS totalCount,',
      'SUM(ob.amountDue) AS totalDue,',
      'SUM(ob.amountPaid) AS totalPaid,',
      "SUM(CASE WHEN ob.status = 'paid' THEN 1 ELSE 0 END) AS paidCount,",
      "SUM(CASE WHEN ob.status IN ('pending','partial','overdue') THEN 1 ELSE 0 END) AS unpaidCount",
      'FROM owner_billing ob',
      'JOIN `user` u ON ob.ownerId = u.id',
      "WHERE u.role = 'owner'",
    ];
    const params = [];

    if (ownerId) {
      sqlParts.push('AND ob.ownerId = ?');
      params.push(ownerId);
    }

    if (status) {
      sqlParts.push('AND ob.status = ?');
      params.push(status);
    }

    if (q) {
      const like = `%${q}%`;
      sqlParts.push('AND (u.firstName LIKE ? OR u.lastName LIKE ? OR u.username LIKE ? OR u.contact LIKE ?)');
      params.push(like, like, like, like);
    }

    applyDateOverlap(sqlParts, params, 'ob', startDate, endDate);

    const rows = await db.query(sqlParts.join(' '), params);
    return res.json({ data: rows[0] || {} });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load billing summary', error: error.message });
  }
}

async function listOwnerPayments(req, res) {
  try {
    const { ownerId, status, q } = req.query;
    const { startDate, endDate, error } = buildDateRange(req.query);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const sqlParts = [
      'SELECT op.*, u.firstName, u.lastName, u.username, u.contact',
      'FROM owner_payment op',
      'JOIN `user` u ON op.ownerId = u.id',
      "WHERE u.role = 'owner'",
    ];
    const params = [];

    if (ownerId) {
      sqlParts.push('AND op.ownerId = ?');
      params.push(ownerId);
    }

    if (status) {
      sqlParts.push('AND op.status = ?');
      params.push(status);
    }

    if (q) {
      const like = `%${q}%`;
      sqlParts.push('AND (u.firstName LIKE ? OR u.lastName LIKE ? OR u.username LIKE ? OR u.contact LIKE ?)');
      params.push(like, like, like, like);
    }

    if (startDate || endDate) {
      applyDateRange(sqlParts, params, 'COALESCE(op.paidAt, op.createdAt)', startDate, endDate);
    }

    sqlParts.push('ORDER BY op.id DESC');
    const rows = await db.query(sqlParts.join(' '), params);
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load owner payments', error: error.message });
  }
}

async function listOwnerPaymentsByOwner(req, res) {
  const { id } = req.params;
  try {
    const { status } = req.query;
    const sqlParts = [
      'SELECT * FROM owner_payment WHERE ownerId = ?',
    ];
    const params = [id];
    if (status) {
      sqlParts.push('AND status = ?');
      params.push(status);
    }
    sqlParts.push('ORDER BY id DESC');
    const rows = await db.query(sqlParts.join(' '), params);
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load owner payment history', error: error.message });
  }
}

function resolveBillingStatus(amountDue, amountPaid) {
  if (amountPaid >= amountDue && amountDue > 0) {
    return 'paid';
  }
  if (amountPaid > 0 && amountPaid < amountDue) {
    return 'partial';
  }
  if (amountDue === 0) {
    return 'paid';
  }
  return 'pending';
}

async function createOwnerPayment(req, res) {
  const {
    ownerId,
    billingId,
    amount,
    currency,
    method,
    status,
    paidAt,
    note,
    proofUrl,
    proofType,
  } = req.body;

  if (!ownerId || amount === undefined) {
    return res.status(400).json({ message: 'ownerId and amount are required' });
  }

  try {
    let billing = null;
    if (billingId) {
      const billingRows = await db.query(
        'SELECT id, ownerId, amountDue, amountPaid FROM owner_billing WHERE id = ? LIMIT 1',
        [billingId]
      );
      billing = billingRows.length ? billingRows[0] : null;
      if (!billing || String(billing.ownerId) !== String(ownerId)) {
        return res.status(400).json({ message: 'Invalid billing record for owner' });
      }
    }

    const paymentStatus = status || 'approved';
    const isApproved = paymentStatus === 'approved';
    const paidAtValue = paidAt || (isApproved ? new Date() : null);
    const result = await db.execute(
      `INSERT INTO owner_payment
        (ownerId, billingId, amount, currency, method, status, paidAt, proofUrl, proofType, note, approvedBy, approvedAt, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        ownerId,
        billingId || null,
        amount,
        currency || 'USD',
        method || 'bank',
        paymentStatus,
        paidAtValue,
        proofUrl || null,
        proofType || null,
        note || null,
        isApproved ? req.user.userId : null,
        isApproved ? new Date() : null,
      ]
    );

    if (isApproved && billing) {
      const nextPaid = Number(billing.amountPaid || 0) + Number(amount || 0);
      const nextStatus = resolveBillingStatus(Number(billing.amountDue || 0), nextPaid);
      await db.execute(
        'UPDATE owner_billing SET amountPaid = ?, status = ?, updatedAt = NOW() WHERE id = ?',
        [nextPaid, nextStatus, billing.id]
      );
    }

    return res.status(201).json({ message: 'Owner payment created', id: result.insertId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create owner payment', error: error.message });
  }
}

async function updateOwnerPaymentStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const paymentRows = await db.query(
      'SELECT id, ownerId, billingId, amount, status FROM owner_payment WHERE id = ? LIMIT 1',
      [id]
    );
    const payment = paymentRows.length ? paymentRows[0] : null;
    if (!payment) {
      return res.status(404).json({ message: 'Owner payment not found' });
    }

    const updates = ['status = ?'];
    const params = [status];

    const approveNow = status === 'approved' && payment.status !== 'approved';
    if (approveNow) {
      updates.push('approvedBy = ?');
      updates.push('approvedAt = NOW()');
      updates.push('paidAt = COALESCE(paidAt, NOW())');
      params.push(req.user.userId);
    }

    const sql = `UPDATE owner_payment SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`;
    params.push(id);
    await db.execute(sql, params);

    if (approveNow && payment.billingId) {
      const billingRows = await db.query(
        'SELECT id, amountDue, amountPaid FROM owner_billing WHERE id = ? LIMIT 1',
        [payment.billingId]
      );
      const billing = billingRows.length ? billingRows[0] : null;
      if (billing) {
        const nextPaid = Number(billing.amountPaid || 0) + Number(payment.amount || 0);
        const nextStatus = resolveBillingStatus(Number(billing.amountDue || 0), nextPaid);
        await db.execute(
          'UPDATE owner_billing SET amountPaid = ?, status = ?, updatedAt = NOW() WHERE id = ?',
          [nextPaid, nextStatus, billing.id]
        );
      }
    }

    return res.json({ message: 'Owner payment updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update owner payment', error: error.message });
  }
}

module.exports = {
  listOwners,
  getOwner,
  updateUser,
  updatePropertyStatus,
  listOwnerBilling,
  getOwnerBillingSummary,
  listOwnerPayments,
  listOwnerPaymentsByOwner,
  createOwnerPayment,
  updateOwnerPaymentStatus,
};
