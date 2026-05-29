const db = require('../lib/db');

async function getMyBilling(req, res) {
  const ownerId = req.user.userId;
  try {
    const billing = await db.query(
      'SELECT * FROM owner_billing WHERE ownerId = ? ORDER BY periodStart DESC',
      [ownerId]
    );
    return res.json({ data: billing });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load billing', error: error.message });
  }
}

async function getMyPayments(req, res) {
  const ownerId = req.user.userId;
  try {
    const payments = await db.query(
      'SELECT * FROM owner_payment WHERE ownerId = ? ORDER BY createdAt DESC',
      [ownerId]
    );
    return res.json({ data: payments });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load payments', error: error.message });
  }
}

async function submitPayment(req, res) {
  const ownerId = req.user.userId;
  const { billingId, amount, method, note, proofUrl } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  try {
    const result = await db.execute(
      `INSERT INTO owner_payment 
        (ownerId, billingId, amount, currency, method, status, createdAt, updatedAt, note, proofUrl) 
       VALUES (?, ?, ?, 'LKR', ?, 'pending', NOW(), NOW(), ?, ?)`,
      [ownerId, billingId || null, amount, method || 'bank', note || null, proofUrl || null]
    );
    return res.status(201).json({ message: 'Payment submitted for approval', id: result.insertId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit payment', error: error.message });
  }
}

async function getSystemStatus(req, res) {
  const ownerId = req.user.userId;
  try {
    const settingsRows = await db.query("SELECT `value` FROM system_settings WHERE `key` = 'global_billing_amount' LIMIT 1");
    const globalFee = settingsRows.length ? Number(settingsRows[0].value) : 0;

    const billingRows = await db.query(
      "SELECT * FROM owner_billing WHERE ownerId = ? ORDER BY periodEnd DESC LIMIT 1",
      [ownerId]
    );
    
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get all payments for this month grouped by status
    const paymentRows = await db.query(
      "SELECT status, SUM(amount) as total FROM owner_payment WHERE ownerId = ? AND createdAt >= ? GROUP BY status",
      [ownerId, monthStart]
    );
    
    let approvedPaid = 0;
    let pendingPaid = 0;
    paymentRows.forEach(row => {
      if (row.status === 'approved') approvedPaid = Number(row.total);
      if (row.status === 'pending') pendingPaid = Number(row.total);
    });

    const latestBilling = billingRows.length ? billingRows[0] : null;
    const amountDue = latestBilling ? Number(latestBilling.amountDue) : globalFee;
    
    // Remaining is what's left after approved payments
    const remaining = Math.max(0, amountDue - approvedPaid);
    
    let status = 'unpaid';
    // If it's fully paid (approved)
    if (remaining <= 0 && amountDue > 0) {
      status = 'paid';
    } 
    // If there's any payment activity (pending or approved but not full)
    else if (pendingPaid > 0 || approvedPaid > 0) {
      status = 'partial';
    }

    return res.json({
      monthName,
      globalFee,
      approvedPaid,
      pendingPaid,
      remaining,
      status,
      latestBilling
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error', error: error.message });
  }
}

async function getGuests(req, res) {
  const ownerId = req.user.userId;
  const { q, startDate, endDate } = req.query;
  try {
    const sqlParts = [
      `SELECT b.id, b.guestName, b.guestContact, b.guestNic, b.checkInDate, b.checkOutDate,
              b.adults, b.children, b.status, b.notes, b.createdAt,
              r.roomNumber, r.roomType, r.floor,
              p.name AS propertyName, p.id AS propertyId`,
      'FROM booking b',
      'JOIN room r ON b.roomId = r.id',
      'JOIN property p ON r.propertyId = p.id',
      'WHERE b.ownerId = ?',
    ];
    const params = [ownerId];

    if (q) {
      const like = `%${q}%`;
      sqlParts.push('AND (b.guestName LIKE ? OR b.guestContact LIKE ? OR b.guestNic LIKE ?)');
      params.push(like, like, like);
    }

    // Date overlap: booking overlaps the search window if checkIn <= endDate AND checkOut >= startDate
    if (startDate) {
      sqlParts.push('AND b.checkOutDate >= ?');
      params.push(startDate);
    }
    if (endDate) {
      sqlParts.push('AND b.checkInDate <= ?');
      params.push(endDate);
    }

    sqlParts.push('ORDER BY b.checkInDate DESC');
    const rows = await db.query(sqlParts.join(' '), params);
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load guests', error: error.message });
  }
}

module.exports = { getMyBilling, getMyPayments, submitPayment, getSystemStatus, getGuests };
