const express = require('express');
const { registerStaff, listStaff } = require('../controllers/auth/staff.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', authenticate, authorizeRoles('owner'), registerStaff);
router.get('/', authenticate, authorizeRoles('owner'), listStaff);

module.exports = router;
