'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const [contacts, sequences, enrollments, sent, replied] = await Promise.all([
      prisma.contact.count(),
      prisma.sequence.count({ where: { userId: req.user.id } }),
      prisma.enrollment.count({ where: { userId: req.user.id } }),
      prisma.emailMessage.count({ where: { status: { in: ['sent', 'simulated'] }, enrollment: { userId: req.user.id } } }),
      prisma.emailMessage.count({ where: { status: 'replied', enrollment: { userId: req.user.id } } }),
    ]);
    const stages = await prisma.contact.groupBy({ by: ['stage'], _count: { stage: true } });
    res.json({ ok: true, stats: { contacts, sequences, enrollments, sent, replied }, stages });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
