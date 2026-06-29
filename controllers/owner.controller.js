const fs = require('fs');
const path = require('path');
const db = require('../lib/db');
const { resolveOwnerContext } = require('../lib/ownership');

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
    let savedProofUrl = null;
    if (proofUrl && proofUrl.startsWith('data:')) {
      const match = proofUrl.match(/^data:(image\/[a-zA-Z]+|application\/pdf);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        let ext = '.png';
        if (mimeType === 'application/pdf') {
          ext = '.pdf';
        } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
          ext = '.jpg';
        } else if (mimeType.includes('gif')) {
          ext = '.gif';
        }
        
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const fileName = `proof-${ownerId}-${Date.now()}${ext}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        savedProofUrl = `/uploads/${fileName}`;
      }
    } else if (proofUrl) {
      savedProofUrl = proofUrl;
    }

    const result = await db.execute(
      `INSERT INTO owner_payment 
        (ownerId, billingId, amount, currency, method, status, createdAt, updatedAt, note, proofUrl) 
       VALUES (?, ?, ?, 'LKR', ?, 'pending', NOW(), NOW(), ?, ?)`,
      [ownerId, billingId || null, amount, method || 'bank', note || null, savedProofUrl]
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

    const userRows = await db.query(
      "SELECT packagePrice, yearlyPrice, yearlyDiscount FROM user WHERE id = ?",
      [ownerId]
    );
    const user = userRows.length ? userRows[0] : {};
    const ownerMonthlyPrice = user.packagePrice != null ? Number(user.packagePrice) : globalFee;

    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStr = now.toISOString().split('T')[0];

    // Check if the current month has a promotion billing record
    const promotionRows = await db.query(
      `SELECT * FROM owner_billing 
       WHERE ownerId = ? AND isPromotion = 1 
         AND periodStart <= ? AND periodEnd >= ?
       ORDER BY periodStart DESC LIMIT 1`,
      [ownerId, todayStr, todayStr]
    );
    const currentPromotion = promotionRows.length ? promotionRows[0] : null;

    // Get the current regular (non-promotion) billing record for this month
    const billingRows = await db.query(
      `SELECT * FROM owner_billing 
       WHERE ownerId = ? AND isPromotion = 0 
         AND periodStart <= ? AND periodEnd >= ?
       ORDER BY periodStart DESC LIMIT 1`,
      [ownerId, todayStr, todayStr]
    );
    const latestBilling = billingRows.length ? billingRows[0] : null;
    const amountDue = latestBilling ? Number(latestBilling.amountDue) : ownerMonthlyPrice;
    
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
    
    // Remaining is what's left after approved payments
    const remaining = Math.max(0, amountDue - approvedPaid);
    
    let status = 'unpaid';
    if (currentPromotion) {
      status = 'promotion';
    } else if (remaining <= 0 && amountDue > 0) {
      status = 'paid';
    } else if (pendingPaid > 0 || approvedPaid > 0) {
      status = 'partial';
    }

    return res.json({
      monthName,
      globalFee,
      approvedPaid,
      pendingPaid,
      remaining,
      status,
      latestBilling,
      ownerPackagePrice: user.packagePrice,
      yearlyPrice: user.yearlyPrice,
      yearlyDiscount: user.yearlyDiscount,
      isCurrentMonthPromotion: !!currentPromotion,
      currentPromotion,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error', error: error.message });
  }
}

async function getGuests(req, res) {
  try {
    const { ownerId, role, propertyId } = await resolveOwnerContext(req);
    const { q, startDate, endDate } = req.query;

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

    if (role === 'staff' && propertyId) {
      sqlParts.push('AND r.propertyId = ?');
      params.push(propertyId);
    }

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

async function getStaffActivity(req, res) {
  try {
    const { ownerId } = await resolveOwnerContext(req);
    const rows = await db.query(
      `SELECT sa.id, sa.staffId, sa.action, sa.details, sa.createdAt,
              u.firstName AS staffFirstName, u.lastName AS staffLastName, u.username AS staffUsername
       FROM staff_activity sa
       JOIN \`user\` u ON sa.staffId = u.id
       WHERE sa.ownerId = ?
       ORDER BY sa.id DESC`,
      [ownerId]
    );
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load staff activity log', error: error.message });
  }
}

module.exports = { getMyBilling, getMyPayments, submitPayment, getSystemStatus, getGuests, getStaffActivity };
