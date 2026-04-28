const express = require('express');
const { registerOwner, login, logout, setCurrentProperty } = require('../controllers/auth/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', registerOwner);
router.post('/login', login);
router.post('/logout', logout);
router.patch('/current-property', authenticate, setCurrentProperty);

module.exports = router;
