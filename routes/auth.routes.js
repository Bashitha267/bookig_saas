const express = require('express');
const { registerOwner, login, logout } = require('../controllers/auth/auth.controller');

const router = express.Router();

router.post('/register', registerOwner);
router.post('/login', login);
router.post('/logout', logout);

module.exports = router;
