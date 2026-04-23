const express = require('express');
const { registerOwner, login } = require('../controllers/auth/auth.controller');

const router = express.Router();

router.post('/register', registerOwner);
router.post('/login', login);

module.exports = router;
