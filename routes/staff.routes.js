const express = require('express');
const { registerStaff } = require('../controllers/auth/staff.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', authenticate, authorizeRoles('owner'), registerStaff);

module.exports = router;
