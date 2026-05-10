const express = require('express');
const {
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
} = require('../controllers/room.controller');
const { authenticate, authenticateOptional, authorizeRoles } = require('../middleware/auth.middleware');
const { cacheResponse } = require('../middleware/cache.middleware');

const router = express.Router();

router.get('/', authenticateOptional, cacheResponse({ ttlMs: 10000 }), listRooms);
router.get('/:id', authenticateOptional, cacheResponse({ ttlMs: 10000 }), getRoom);

router.use(authenticate);

router.post('/', authorizeRoles('owner', 'admin'), createRoom);
router.put('/:id', authorizeRoles('owner', 'admin'), updateRoom);
router.delete('/:id', authorizeRoles('owner', 'admin'), deleteRoom);

module.exports = router;
