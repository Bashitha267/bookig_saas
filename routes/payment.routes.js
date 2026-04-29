const express = require('express');
const {
  listPayments,
  getPayment,
  createPayment,
  updatePayment,
  deletePayment,
} = require('../controllers/payment.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeRoles('owner', 'admin', 'staff'), listPayments);
router.get('/:id', authorizeRoles('owner', 'admin', 'staff'), getPayment);
router.post('/', authorizeRoles('owner', 'admin'), createPayment);
router.put('/:id', authorizeRoles('owner', 'admin'), updatePayment);
router.delete('/:id', authorizeRoles('owner', 'admin'), deletePayment);

module.exports = router;
