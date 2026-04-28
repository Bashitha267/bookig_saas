const express = require('express');
const {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
} = require('../controllers/property.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeRoles('owner', 'admin'), listProperties);
router.get('/:id', authorizeRoles('owner', 'admin'), getProperty);
router.post('/', authorizeRoles('owner', 'admin'), createProperty);
router.put('/:id', authorizeRoles('owner', 'admin'), updateProperty);
router.delete('/:id', authorizeRoles('owner', 'admin'), deleteProperty);

module.exports = router;
