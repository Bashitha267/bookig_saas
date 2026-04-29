const express = require('express');
const {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
} = require('../controllers/property.controller');
const { authenticate, authenticateOptional, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/', authenticateOptional, listProperties);
router.get('/:id', authenticateOptional, getProperty);

router.use(authenticate);

router.post('/', authorizeRoles('owner', 'admin'), createProperty);
router.put('/:id', authorizeRoles('owner', 'admin'), updateProperty);
router.delete('/:id', authorizeRoles('owner', 'admin'), deleteProperty);

module.exports = router;
