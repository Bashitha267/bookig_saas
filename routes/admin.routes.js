const express = require('express');
const { createAdmin } = require('../controllers/auth/admin.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/create', authenticate, authorizeRoles('admin'), createAdmin);

module.exports = router;
