/**
 * MedFinder - Auth Routes
 */
const express = require('express');
const router  = express.Router();
const { login } = require('../middleware/auth');

router.post('/login', login);   // POST /api/auth/login

module.exports = router;
