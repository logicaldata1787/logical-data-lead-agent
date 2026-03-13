'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/users — list users (admin only)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ ok: true, users });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/users/invite — admin creates/invites a user
router.post('/invite', requireAuth, requireAdmin, async (req, res) => {
  const { email, name, role, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) return res.status(409).json({ ok: false, error: 'User already exists' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase().trim(), passwordHash, name, role: role || 'user' },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });
    res.status(201).json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/users/:id — update user
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, role, isActive, password } = req.body || {};
  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true }
    });
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
