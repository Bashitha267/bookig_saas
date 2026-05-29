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
router.get('/owners', cacheResponse({ ttlMs: 15000 }), listOwners);
router.get('/owners/:id', cacheResponse({ ttlMs: 15000 }), getOwner);
router.get('/owners/:id/payments', cacheResponse({ ttlMs: 15000 }), listOwnerPaymentsByOwner);
router.patch('/users/:id', updateUser);
router.patch('/properties/:id/status', updatePropertyStatus);

router.get('/billing', cacheResponse({ ttlMs: 15000 }), listOwnerBilling);
router.post('/billing', createOwnerBilling);
router.get('/billing/summary', cacheResponse({ ttlMs: 15000 }), getOwnerBillingSummary);

router.get('/owner-payments', cacheResponse({ ttlMs: 15000 }), listOwnerPayments);
router.post('/owner-payments', createOwnerPayment);
router.patch('/owner-payments/:id/status', updateOwnerPaymentStatus);

router.get('/settings', cacheResponse({ ttlMs: 30000 }), getSystemSettings);
router.post('/settings', updateSystemSetting);

module.exports = router;
