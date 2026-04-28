const express = require('express');
const {
  listBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking,
} = require('../controllers/booking.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeRoles('owner', 'admin', 'staff'), listBookings);
router.get('/:id', authorizeRoles('owner', 'admin', 'staff'), getBooking);
router.post('/', authorizeRoles('owner', 'admin', 'staff'), createBooking);
router.put('/:id', authorizeRoles('owner', 'admin', 'staff'), updateBooking);
router.delete('/:id', authorizeRoles('owner', 'admin'), deleteBooking);

module.exports = router;
