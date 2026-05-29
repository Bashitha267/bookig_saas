const express = require('express');
const { getMyBilling, getMyPayments, submitPayment, getSystemStatus, getGuests } = require('../controllers/owner.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('owner'));

router.get('/status', getSystemStatus);
router.get('/billing', getMyBilling);
router.get('/payments', getMyPayments);
router.post('/payments', submitPayment);
router.get('/guests', getGuests);

module.exports = router;
