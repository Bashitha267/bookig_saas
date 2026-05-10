const express = require('express');
const {
  listBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking,
} = require('../controllers/booking.controller');
const { authenticate, authenticateOptional, authorizeRoles } = require('../middleware/auth.middleware');
const { cacheResponse } = require('../middleware/cache.middleware');

const router = express.Router();

router.post('/', authenticateOptional, createBooking);

router.use(authenticate);

router.get('/', authorizeRoles('owner', 'admin', 'staff'), cacheResponse({ ttlMs: 10000 }), listBookings);
router.get('/:id', authorizeRoles('owner', 'admin', 'staff'), cacheResponse({ ttlMs: 10000 }), getBooking);
router.put('/:id', authorizeRoles('owner', 'admin', 'staff'), updateBooking);
router.delete('/:id', authorizeRoles('owner', 'admin'), deleteBooking);

module.exports = router;
