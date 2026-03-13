'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { requireAuth } = require('../middleware/auth');

// GET /api/inbox — get all replied/incoming messages
router.get('/', requireAuth, async (req, res) => {
  try {
    const messages = await prisma.emailMessage.findMany({
      where: { enrollment: { userId: req.user.id }, status: { in: ['replied', 'opened'] } },
      include: { contact: { select: { id: true, email: true, firstName: true, lastName: true, companyName: true, stage: true } }, sequenceStep: { select: { subject: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100
    });
    res.json({ ok: true, messages });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PATCH /api/inbox/:messageId/replied — mark as replied
router.patch('/:messageId/replied', requireAuth, async (req, res) => {
  try {
    const msg = await prisma.emailMessage.findUnique({ where: { id: req.params.messageId }, include: { enrollment: true } });
    if (!msg) return res.status(404).json({ ok: false, error: 'Not found' });
    await prisma.emailMessage.update({ where: { id: req.params.messageId }, data: { status: 'replied', repliedAt: new Date() } });
    if (msg.enrollment) {
      await prisma.enrollment.update({ where: { id: msg.enrollmentId }, data: { status: 'replied' } });
      await prisma.contact.update({ where: { id: msg.contactId }, data: { stage: 'replied' } });
    }
    await prisma.activityLog.create({ data: { contactId: msg.contactId, userId: req.user.id, type: 'replied', metadata: {} } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
