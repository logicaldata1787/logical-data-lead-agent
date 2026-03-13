'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');
const { signToken, requireAuth } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.isActive) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, name: true, role: true } });
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
