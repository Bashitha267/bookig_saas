const express = require('express');
const { createAdmin, listAdmins } = require('../controllers/auth/admin.controller');
const {
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
} = require('../controllers/admin.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');
const { cacheResponse } = require('../middleware/cache.middleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.post('/create', createAdmin);
router.get('/admins', listAdmins);
router.get('/users/recent-logged', listRecentLoggedUsers);
router.get('/users/online', listOnlineUsers);
router.get('/owners', listOwners);
router.get('/owners/:id', getOwner);
router.get('/owners/:id/payments', listOwnerPaymentsByOwner);
router.patch('/users/:id', updateUser);
router.patch('/properties/:id/status', updatePropertyStatus);

router.get('/billing', listOwnerBilling);
router.post('/billing', createOwnerBilling);
router.get('/billing/summary', getOwnerBillingSummary);

router.get('/owner-payments', listOwnerPayments);
router.post('/owner-payments', createOwnerPayment);
router.patch('/owner-payments/:id/status', updateOwnerPaymentStatus);
router.delete('/owner-payments/:id', deleteOwnerPayment);

router.get('/settings', getSystemSettings);
router.post('/settings', updateSystemSetting);

module.exports = router;
