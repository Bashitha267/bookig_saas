const express = require('express');
const {
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
} = require('../controllers/room.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeRoles('owner', 'admin', 'staff'), listRooms);
router.get('/:id', authorizeRoles('owner', 'admin', 'staff'), getRoom);
router.post('/', authorizeRoles('owner', 'admin'), createRoom);
router.put('/:id', authorizeRoles('owner', 'admin'), updateRoom);
router.delete('/:id', authorizeRoles('owner', 'admin'), deleteRoom);

module.exports = router;
