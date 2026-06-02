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
      'u.packagePrice, u.yearlyPrice, u.yearlyDiscount,',
      'COUNT(DISTINCT p.id) AS propertyCount,',
      'COUNT(DISTINCT s.id) AS staffCount,',
      'MAX(ob.status) AS currentBillingStatus,',
      'MAX(ob.amountDue) AS currentAmountDue,',
      'MAX(ob.amountPaid) AS currentAmountPaid,',
      'MAX(ob.isPromotion) AS currentIsPromotion',
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
      "SELECT id, firstName, lastName, username, contact, whatsapp, address, email, status, createdAt, packagePrice, yearlyPrice, yearlyDiscount FROM `user` WHERE id = ? AND role = 'owner' LIMIT 1",
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
      'SELECT id, periodStart, periodEnd, amountDue, amountPaid, status, isPromotion, billingCycle, discount, note FROM owner_billing WHERE ownerId = ? AND periodStart <= CURRENT_DATE() AND periodEnd >= CURRENT_DATE() ORDER BY periodStart DESC LIMIT 1',
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
  const { username, password, email, status, packagePrice, yearlyPrice, yearlyDiscount } = req.body;

  if (!username && !password && email === undefined && !status && packagePrice === undefined && yearlyPrice === undefined && yearlyDiscount === undefined) {
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

    if (packagePrice !== undefined) {
      // null means "use global price", otherwise store the custom value
      const price = packagePrice === '' || packagePrice === null ? null : Number(packagePrice);
      updates.push('packagePrice = ?');
      params.push(price);
    }

    if (yearlyPrice !== undefined) {
      const price = yearlyPrice === '' || yearlyPrice === null ? null : Number(yearlyPrice);
      updates.push('yearlyPrice = ?');
      params.push(price);
    }

    if (yearlyDiscount !== undefined) {
      const discount = yearlyDiscount === '' || yearlyDiscount === null ? null : Number(yearlyDiscount);
      updates.push('yearlyDiscount = ?');
      params.push(discount);
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

async function getSystemSettings(req, res) {
  try {
    const rows = await db.query('SELECT * FROM system_settings');
    const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    return res.json({ data: settings });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load settings', error: error.message });
  }
}

async function updateSystemSetting(req, res) {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ message: 'Key is required' });
  try {
    await db.execute(
      'INSERT INTO system_settings (`key`, `value`, `updatedAt`) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `value` = ?, `updatedAt` = NOW()',
      [key, String(value), String(value)]
    );
    return res.json({ message: 'Setting updated' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update setting', error: error.message });
  }
}

async function createOwnerBilling(req, res) {
  const { ownerId, amountDue, periodStart, periodEnd } = req.body;
  if (!ownerId || amountDue === undefined || !periodStart || !periodEnd) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const result = await db.execute(
      'INSERT INTO owner_billing (ownerId, amountDue, amountPaid, periodStart, periodEnd, status, createdAt, updatedAt) VALUES (?, ?, 0, ?, ?, ?, NOW(), NOW())',
      [ownerId, amountDue, periodStart, periodEnd, 'pending']
    );
    return res.status(201).json({ message: 'Billing record created', id: result.insertId });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create billing record', error: error.message });
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
      if (status === 'promotions') {
        sqlParts.push('AND ob.isPromotion = 1');
      } else {
        sqlParts.push('AND ob.status = ? AND ob.isPromotion = 0');
        params.push(status);
      }
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

    // 1. Fetch system settings for global_billing_amount
    const settingsRows = await db.query("SELECT value FROM system_settings WHERE `key` = 'global_billing_amount' LIMIT 1");
    const globalFee = settingsRows.length ? Number(settingsRows[0].value) : 0;

    // 2. Fetch all matching owners
    const ownerSql = ["SELECT id, firstName, lastName, username, contact, packagePrice, createdAt FROM `user` WHERE role = 'owner'"];
    const ownerParams = [];
    if (ownerId) {
      ownerSql.push('AND id = ?');
      ownerParams.push(ownerId);
    }
    if (q) {
      const like = `%${q}%`;
      ownerSql.push('AND (firstName LIKE ? OR lastName LIKE ? OR username LIKE ? OR contact LIKE ?)');
      ownerParams.push(like, like, like, like);
    }
    const owners = await db.query(ownerSql.join(' '), ownerParams);

    // 3. Fetch all matching actual billing records
    const billingSql = [
      'SELECT ob.* FROM owner_billing ob',
      'JOIN `user` u ON ob.ownerId = u.id',
      "WHERE u.role = 'owner'"
    ];
    const billingParams = [];
    if (ownerId) {
      billingSql.push('AND ob.ownerId = ?');
      billingParams.push(ownerId);
    }
    if (q) {
      const like = `%${q}%`;
      billingSql.push('AND (u.firstName LIKE ? OR u.lastName LIKE ? OR u.username LIKE ? OR u.contact LIKE ?)');
      billingParams.push(like, like, like, like);
    }
    applyDateOverlap(billingSql, billingParams, 'ob', startDate, endDate);
    const billingRecords = await db.query(billingSql.join(' '), billingParams);

    // Determine simulation range bounds
    let rangeStart = null;
    let rangeEnd = null;

    if (startDate) {
      rangeStart = new Date(startDate);
    } else if (owners.length > 0) {
      const minDate = owners.reduce((min, o) => {
        const d = new Date(o.createdAt);
        return d < min ? d : min;
      }, new Date(owners[0].createdAt));
      rangeStart = minDate;
    } else {
      rangeStart = new Date();
    }

    if (endDate) {
      rangeEnd = new Date(endDate);
    } else {
      rangeEnd = new Date();
    }

    // Initialize summary metrics
    let totalCount = 0;
    let totalDue = 0;
    let totalPaid = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let promotionCount = 0;
    let promotionValue = 0;
    let totalDiscount = 0;

    const processedBillingIds = new Set();

    owners.forEach((owner) => {
      const ownerBills = billingRecords.filter(b => b.ownerId === owner.id);

      // Accumulate actual billing records in the range
      ownerBills.forEach((bill) => {
        if (!processedBillingIds.has(bill.id)) {
          processedBillingIds.add(bill.id);

          // Apply status filter if provided
          if (status) {
            if (status === 'promotions' && bill.isPromotion !== 1) return;
            if (status !== 'promotions' && (bill.status !== status || bill.isPromotion === 1)) return;
          }

          if (bill.isPromotion === 1) {
            promotionCount++;
            promotionValue += Number(bill.amountDue || 0);
          } else {
            totalCount++;
            totalDue += Number(bill.amountDue || 0);
            totalPaid += Number(bill.amountPaid || 0);
            totalDiscount += Number(bill.discount || 0);

            if (bill.status === 'paid') {
              paidCount++;
            } else {
              unpaidCount++;
            }
          }
        }
      });

      // Simulation of missing monthly periods
      const startYear = rangeStart.getFullYear();
      const startMonth = rangeStart.getMonth();
      const endYear = rangeEnd.getFullYear();
      const endMonth = rangeEnd.getMonth();

      for (let y = startYear; y <= endYear; y++) {
        const mStartIdx = (y === startYear) ? startMonth : 0;
        const mEndIdx = (y === endYear) ? endMonth : 11;
        for (let m = mStartIdx; m <= mEndIdx; m++) {
          const mStart = new Date(y, m, 1);
          const mEnd = new Date(y, m + 1, 0);

          const createdDate = new Date(owner.createdAt);
          const isOwnerActive = createdDate <= mEnd;
          // Check if any actual billing record covers this month
          const isCovered = ownerBills.some(b => {
            const bStart = new Date(b.periodStart);
            const bEnd = new Date(b.periodEnd);
            return bStart <= mEnd && bEnd >= mStart;
          });

          if (isOwnerActive && !isCovered) {
            // Apply status filter if provided (simulated records are always 'pending')
            if (!status || status === 'pending') {
              const simulatedDue = owner.packagePrice !== null ? Number(owner.packagePrice) : globalFee;
              totalCount++;
              totalDue += simulatedDue;
              unpaidCount++;
            }
          }
        }
      }
    });

    return res.json({
      data: {
        totalCount,
        totalDue,
        totalPaid,
        paidCount,
        unpaidCount,
        promotionCount,
        promotionValue,
        totalDiscount
      }
    });
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
      'SELECT op.*, u.firstName, u.lastName, u.username, u.contact, ob.amountDue AS billingAmountDue, ob.amountPaid AS billingAmountPaid',
      'FROM owner_payment op',
      'JOIN `user` u ON op.ownerId = u.id',
      'LEFT JOIN owner_billing ob ON ob.id = op.billingId',
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
    // New fields
    isPromotion,
    billingCycle,
    monthsCovered,
    discount,
    periodStart,
    periodEnd,
  } = req.body;

  if (!ownerId || amount === undefined) {
    return res.status(400).json({ message: 'ownerId and amount are required' });
  }

  try {
    const paymentStatus = status || 'approved';
    const isApproved = paymentStatus === 'approved';
    const paidAtValue = paidAt || (isApproved ? new Date() : null);
    const cycle = billingCycle || 'monthly';
    const discountAmt = Number(discount || 0);
    const promoFlag = isPromotion ? 1 : 0;

    // ── Case 1: Promotion / Free Trial ───────────────────────────────────────────
    if (isPromotion && periodStart && periodEnd) {
      // Look up owner's custom price or global price for the "waived" value
      const ownerRows = await db.query(
        "SELECT packagePrice FROM `user` WHERE id = ? LIMIT 1", [ownerId]
      );
      const settingsRows = await db.query(
        "SELECT value FROM system_settings WHERE `key` = 'global_billing_amount' LIMIT 1"
      );
      const globalFee = settingsRows.length ? Number(settingsRows[0].value) : 0;
      const ownerPrice = ownerRows.length && ownerRows[0].packagePrice !== null
        ? Number(ownerRows[0].packagePrice) : globalFee;

      // ON DUPLICATE KEY UPDATE handles the case where a regular billing record
      // already exists for this period (unique key: ownerId+periodStart+periodEnd).
      // It converts that record into a promotion instead of throwing a duplicate error.
      await db.execute(
        `INSERT INTO owner_billing
          (ownerId, periodStart, periodEnd, amountDue, amountPaid, status, isPromotion, billingCycle, discount, note, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'paid', 1, ?, 0, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           amountDue    = VALUES(amountDue),
           amountPaid   = VALUES(amountPaid),
           status       = 'paid',
           isPromotion  = 1,
           billingCycle = VALUES(billingCycle),
           discount     = 0,
           note         = COALESCE(VALUES(note), note),
           updatedAt    = NOW()`,
        [ownerId, periodStart, periodEnd, ownerPrice, ownerPrice, cycle, note || null]
      );

      return res.status(201).json({ message: 'Promotion period created', promoted: true });
    }

    // 🔹 Case 2: Standard Payment (1 or more months) 🔹
    let insertedBillingIds = [];
    if (periodStart) {
      const months = Number(monthsCovered) || 1;
      const ownerRows = await db.query(
        "SELECT packagePrice, yearlyPrice, yearlyDiscount FROM `user` WHERE id = ? LIMIT 1", [ownerId]
      );
      const settingsRows = await db.query(
        "SELECT value FROM system_settings WHERE `key` = 'global_billing_amount' LIMIT 1"
      );
      const globalFee = settingsRows.length ? Number(settingsRows[0].value) : 0;
      
      let basePrice = globalFee;
      let calculatedDiscount = discountAmt;

      if (ownerRows.length) {
        if (cycle === 'yearly' && ownerRows[0].yearlyPrice != null) {
          basePrice = Number(ownerRows[0].yearlyPrice) / 12; // Base price spread over 12 months for calculation
          // If yearly discount is configured and no manual discount was provided, use the user's config
          if (!discountAmt && ownerRows[0].yearlyDiscount != null) {
            calculatedDiscount = Number(ownerRows[0].yearlyDiscount);
          }
        } else if (ownerRows[0].packagePrice !== null) {
          basePrice = Number(ownerRows[0].packagePrice);
        }
      }

      // Per-month amount after discount (total discount spread equally)
      const totalDiscount = calculatedDiscount;
      const totalDue = basePrice * months - totalDiscount;
      const perMonthDue = Number((totalDue / months).toFixed(2));
      const perMonthPaid = isApproved ? perMonthDue : 0;
      const perMonthDiscount = Number((totalDiscount / months).toFixed(2));

      const startDate = new Date(periodStart);
      for (let i = 0; i < months; i++) {
        const mStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const mEnd = new Date(startDate.getFullYear(), startDate.getMonth() + i + 1, 0);
        const mStartStr = mStart.toISOString().split('T')[0];
        const mEndStr = mEnd.toISOString().split('T')[0];
        const billingStatus = isApproved ? resolveBillingStatus(perMonthDue, perMonthPaid) : 'pending';

        const billingResult = await db.execute(
          `INSERT INTO owner_billing
            (ownerId, periodStart, periodEnd, amountDue, amountPaid, status, isPromotion, billingCycle, discount, note, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             amountDue = VALUES(amountDue),
             amountPaid = amountPaid + VALUES(amountPaid),
             status = VALUES(status),
             billingCycle = VALUES(billingCycle),
             discount = VALUES(discount),
             updatedAt = NOW()`,
          [ownerId, mStartStr, mEndStr, perMonthDue, perMonthPaid, billingStatus, cycle, perMonthDiscount, note || null]
        );
        insertedBillingIds.push(billingResult.insertId || null);
      }
    } else if (billingId) {
      // Single existing billing record
      const billingRows = await db.query(
        'SELECT id, ownerId, amountDue, amountPaid FROM owner_billing WHERE id = ? LIMIT 1',
        [billingId]
      );
      const billing = billingRows.length ? billingRows[0] : null;
      if (!billing || String(billing.ownerId) !== String(ownerId)) {
        return res.status(400).json({ message: 'Invalid billing record for owner' });
      }
      if (isApproved) {
        const nextPaid = Number(billing.amountPaid || 0) + Number(amount || 0);
        const nextStatus = resolveBillingStatus(Number(billing.amountDue || 0), nextPaid);
        await db.execute(
          'UPDATE owner_billing SET amountPaid = ?, status = ?, updatedAt = NOW() WHERE id = ?',
          [nextPaid, nextStatus, billing.id]
        );
      }
      insertedBillingIds = [billingId];
    }

    // Create the actual payment transaction record
    const result = await db.execute(
      `INSERT INTO owner_payment
        (ownerId, billingId, amount, currency, method, status, paidAt, proofUrl, proofType, note, approvedBy, approvedAt, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        ownerId,
        insertedBillingIds[0] || billingId || null,
        amount,
        currency || 'LKR',
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

    return res.status(201).json({ message: 'Owner payment created', id: result.insertId, billingIds: insertedBillingIds });
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

async function deleteOwnerPayment(req, res) {
  const { id } = req.params;
  try {
    const payment = await db.query('SELECT * FROM owner_payment WHERE id = ?', [id]);
    if (!payment.length) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const { billingId, amount, status } = payment[0];

    await db.query('DELETE FROM owner_payment WHERE id = ?', [id]);

    if (billingId && status === 'approved') {
      await db.query(
        'UPDATE owner_billing SET amountPaid = amountPaid - ? WHERE id = ?',
        [amount, billingId]
      );
      
      const billingRec = await db.query('SELECT amountDue, amountPaid FROM owner_billing WHERE id = ?', [billingId]);
      if (billingRec.length) {
        const { amountDue, amountPaid } = billingRec[0];
        let newStatus = 'pending';
        if (Number(amountPaid) >= Number(amountDue) && Number(amountDue) > 0) newStatus = 'paid';
        else if (Number(amountPaid) > 0) newStatus = 'partial';
        await db.query('UPDATE owner_billing SET status = ? WHERE id = ?', [newStatus, billingId]);
      }
    }

    return res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete payment', error: error.message });
  }
}

async function listRecentLoggedUsers(req, res) {
  try {
    const rows = await db.query(
      "SELECT id, firstName, lastName, username, role, email, contact, lastLoginAt FROM `user` WHERE lastLoginAt IS NOT NULL ORDER BY lastLoginAt DESC LIMIT 10"
    );
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load recent logged users', error: error.message });
  }
}

async function listOnlineUsers(req, res) {
  try {
    const rows = await db.query(
      "SELECT id, firstName, lastName, username, role, email, contact, lastActiveAt FROM `user` WHERE lastActiveAt >= DATE_SUB(NOW(3), INTERVAL 5 MINUTE) ORDER BY lastActiveAt DESC"
    );
    return res.json({ data: rows });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load online users', error: error.message });
  }
}

/**
 * GET /admin/reports/revenue?year=YYYY
 * Returns a full monthly revenue report for the given year.
 * - Uses real per-owner prices (packagePrice > globalFee fallback)
 * - Yearly billing is spread across 12 months (amountDue / 12 per month)
 * - Tracks promotions separately
 */
async function getRevenueReport(req, res) {
  const { year } = req.query;
  const y = Number.parseInt(year, 10) || new Date().getFullYear();

  try {
    // Global fee
    const settingsRows = await db.query("SELECT value FROM system_settings WHERE `key` = 'global_billing_amount' LIMIT 1");
    const globalFee = settingsRows.length ? Number(settingsRows[0].value) : 0;

    // All owners with their prices
    const owners = await db.query(
      "SELECT id, firstName, lastName, username, packagePrice, yearlyPrice, yearlyDiscount, createdAt FROM `user` WHERE role = 'owner' ORDER BY id ASC"
    );

    // All billing records for this year (regular + promotions)
    const billing = await db.query(
      `SELECT ob.*, u.firstName, u.lastName, u.username, u.packagePrice, u.yearlyPrice
       FROM owner_billing ob
       JOIN \`user\` u ON ob.ownerId = u.id
       WHERE YEAR(ob.periodStart) = ? OR YEAR(ob.periodEnd) = ?`,
      [y, y]
    );

    // All approved payments for this year
    const payments = await db.query(
      `SELECT op.*, u.firstName, u.lastName, u.username
       FROM owner_payment op
       JOIN \`user\` u ON op.ownerId = u.id
       WHERE op.status = 'approved'
         AND (YEAR(op.paidAt) = ? OR YEAR(op.createdAt) = ?)`,
      [y, y]
    );

    // Build month slots [0..11]
    const months = Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i,
      revenue: 0,
      promotionValue: 0,
      promotionCount: 0,
      expectedDue: 0,
      newOwners: 0,
      ownerCount: 0,
    }));

    // Count owner-months for expectedDue (owners active in each month)
    owners.forEach((owner) => {
      const created = new Date(owner.createdAt);
      const ownerYear = created.getFullYear();
      const startMonth = ownerYear < y ? 0 : (ownerYear === y ? created.getMonth() : 999);
      if (ownerYear > y) return;

      const ownerMonthlyPrice = owner.packagePrice != null ? Number(owner.packagePrice) : globalFee;

      if (ownerYear === y) {
        months[created.getMonth()].newOwners += 1;
      }

      for (let i = startMonth; i < 12; i++) {
        months[i].ownerCount += 1;
        months[i].expectedDue += ownerMonthlyPrice;
      }
    });

    // Process billing records (promotions + regular)
    billing.forEach((bill) => {
      const start = new Date(bill.periodStart);
      const end = new Date(bill.periodEnd);
      if (bill.isPromotion) {
        // Assign promotion to the start month if it falls in this year
        const mIdx = start.getMonth();
        if (start.getFullYear() === y || end.getFullYear() === y) {
          months[mIdx].promotionValue += Number(bill.amountDue || 0);
          months[mIdx].promotionCount += 1;
        }
      }
      // For yearly billing spread across months
      if (bill.billingCycle === 'yearly' && bill.amountDue > 0) {
        const perMonth = Number(bill.amountDue) / 12;
        for (let i = 0; i < 12; i++) {
          // Only count if the year matches
          const monthYear = start.getFullYear();
          if (monthYear === y) {
            // already handled via payments
          }
        }
      }
    });

    // Process approved payments — credit to the month paid
    payments.forEach((p) => {
      const date = new Date(p.paidAt || p.createdAt);
      if (date.getFullYear() !== y) return;
      const mIdx = date.getMonth();

      // Find the linked billing record to check if yearly
      const linkedBill = billing.find(b => b.id === p.billingId);
      if (linkedBill && linkedBill.billingCycle === 'yearly') {
        // Spread the yearly payment across 12 months
        const perMonth = Number(p.amount) / 12;
        for (let i = 0; i < 12; i++) {
          months[i].revenue += perMonth;
        }
      } else {
        months[mIdx].revenue += Number(p.amount || 0);
      }
    });

    // Totals
    const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
    const totalExpected = months.reduce((s, m) => s + m.expectedDue, 0);
    const totalPromotions = months.reduce((s, m) => s + m.promotionCount, 0);
    const totalPromotionValue = months.reduce((s, m) => s + m.promotionValue, 0);

    // Owner-level breakdown
    const ownerBreakdown = owners.map((owner) => {
      const ownerBills = billing.filter(b => b.ownerId === owner.id);
      const ownerPayments = payments.filter(p => p.ownerId === owner.id);
      const ownerPrice = owner.packagePrice != null ? Number(owner.packagePrice) : globalFee;
      const totalPaid = ownerPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const promos = ownerBills.filter(b => b.isPromotion);

      // Build 12-month breakdown for this owner
      const monthlyData = Array.from({ length: 12 }, (_, i) => ({
        monthIndex: i,
        paid: 0,
        isPromotion: false,
        promoValue: 0
      }));

      // Populate monthly bills (promotions)
      ownerBills.forEach(b => {
        const start = new Date(b.periodStart);
        const mIdx = start.getMonth();
        if (start.getFullYear() === y) {
          if (b.isPromotion) {
            monthlyData[mIdx].isPromotion = true;
            monthlyData[mIdx].promoValue = Number(b.amountDue || 0);
          }
        }
      });

      // Populate monthly payments
      ownerPayments.forEach(p => {
        const date = new Date(p.paidAt || p.createdAt);
        if (date.getFullYear() !== y) return;
        const mIdx = date.getMonth();

        const linkedBill = billing.find(b => b.id === p.billingId);
        if (linkedBill && linkedBill.billingCycle === 'yearly') {
          // Spread yearly payment
          const perMonth = Number(p.amount) / 12;
          for (let i = 0; i < 12; i++) {
            monthlyData[i].paid += perMonth;
          }
        } else {
          monthlyData[mIdx].paid += Number(p.amount || 0);
        }
      });

      return {
        id: owner.id,
        name: `${owner.firstName} ${owner.lastName}`,
        username: owner.username,
        monthlyPrice: ownerPrice,
        totalPaid,
        promotionCount: promos.length,
        promotionMonths: promos.map(p => ({
          start: p.periodStart,
          end: p.periodEnd,
          value: Number(p.amountDue),
        })),
        monthlyData,
      };
    });

    return res.json({
      year: y,
      globalFee,
      months,
      totals: { totalRevenue, totalExpected, totalPromotions, totalPromotionValue, outstanding: Math.max(0, totalExpected - totalRevenue - totalPromotionValue) },
      ownerBreakdown,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to generate report', error: error.message });
  }
}

module.exports = {
  listOwners,
  getOwner,
  updateUser,
  updatePropertyStatus,
  listOwnerBilling,
  createOwnerBilling,
  getOwnerBillingSummary,
  listOwnerPayments,
  listOwnerPaymentsByOwner,
  createOwnerPayment,
  updateOwnerPaymentStatus,
  deleteOwnerPayment,
  getSystemSettings,
  updateSystemSetting,
  listRecentLoggedUsers,
  listOnlineUsers,
  getRevenueReport,
};
