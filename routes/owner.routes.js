const express = require('express');
const { getMyBilling, getMyPayments, submitPayment } = require('../controllers/owner.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('owner'));

router.get('/billing', getMyBilling);
router.get('/payments', getMyPayments);
router.post('/payments', submitPayment);

module.exports = router;
