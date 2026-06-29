const express = require('express');
const { getMyBilling, getMyPayments, submitPayment, getSystemStatus, getGuests, getStaffActivity } = require('../controllers/owner.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/status', authorizeRoles('owner'), getSystemStatus);
router.get('/billing', authorizeRoles('owner'), getMyBilling);
router.get('/payments', authorizeRoles('owner'), getMyPayments);
router.post('/payments', authorizeRoles('owner'), submitPayment);
router.get('/guests', authorizeRoles('owner', 'staff'), getGuests);
router.get('/staff-activity', authorizeRoles('owner'), getStaffActivity);

module.exports = router;
