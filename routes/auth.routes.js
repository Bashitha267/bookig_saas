const express = require('express');
const {
  registerOwner,
  login,
  logout,
  setCurrentProperty,
  forgotPassword,
  resetPassword,
} = require('../controllers/auth/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', registerOwner);
router.post('/login', login);
router.post('/logout', logout);
router.patch('/current-property', authenticate, setCurrentProperty);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
