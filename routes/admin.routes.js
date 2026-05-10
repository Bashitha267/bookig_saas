const express = require('express');
const { createAdmin } = require('../controllers/auth/admin.controller');
const {
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
} = require('../controllers/admin.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate, authorizeRoles('admin'));

router.post('/create', createAdmin);
router.get('/owners', listOwners);
router.get('/owners/:id', getOwner);
router.get('/owners/:id/payments', listOwnerPaymentsByOwner);
router.patch('/users/:id', updateUser);
router.patch('/properties/:id/status', updatePropertyStatus);

router.get('/billing', listOwnerBilling);
router.get('/billing/summary', getOwnerBillingSummary);

router.get('/owner-payments', listOwnerPayments);
router.post('/owner-payments', createOwnerPayment);
router.patch('/owner-payments/:id/status', updateOwnerPaymentStatus);

module.exports = router;
