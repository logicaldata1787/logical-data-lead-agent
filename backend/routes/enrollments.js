'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { requireAuth } = require('../middleware/auth');

function computeNextSendAt(delayDays) {
  const d = new Date();
  d.setDate(d.getDate() + delayDays);
  // Set to 9am local
  d.setHours(9, 0, 0, 0);
  return d;
}

// GET /api/enrollments
router.get('/', requireAuth, async (req, res) => {
  try {
    const { sequenceId, status, page = 1, limit = 50 } = req.query;
    const where = { userId: req.user.id };
    if (sequenceId) where.sequenceId = sequenceId;
    if (status) where.status = status;
    const [enrollments, total] = await Promise.all([
      prisma.enrollment.findMany({
        where, orderBy: { createdAt: 'desc' },
        include: { contact: { select: { id: true, email: true, firstName: true, lastName: true, companyName: true, stage: true } }, sequence: { select: { id: true, name: true } } },
        skip: (Number(page) - 1) * Number(limit), take: Number(limit)
      }),
      prisma.enrollment.count({ where })
    ]);
    res.json({ ok: true, enrollments, total });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/enrollments — enroll one or more contacts into a sequence
router.post('/', requireAuth, async (req, res) => {
  const { contactIds, sequenceId, eventId } = req.body || {};
  if (!contactIds?.length || !sequenceId) return res.status(400).json({ ok: false, error: 'contactIds and sequenceId required' });
  try {
    const seq = await prisma.sequence.findFirst({ where: { id: sequenceId, userId: req.user.id }, include: { steps: { orderBy: { stepNumber: 'asc' } } } });
    if (!seq) return res.status(404).json({ ok: false, error: 'Sequence not found' });
    if (!seq.steps.length) return res.status(400).json({ ok: false, error: 'Sequence has no steps' });
    const firstStep = seq.steps[0];
    const nextSendAt = computeNextSendAt(firstStep.delayDays);
    let enrolled = 0, skipped = 0;
    for (const contactId of contactIds) {
      const contact = await prisma.contact.findUnique({ where: { id: contactId } });
      if (!contact || contact.doNotContact || contact.unsubscribed) { skipped++; continue; }
      const suppressed = await prisma.suppression.findUnique({ where: { email: contact.email } });
      if (suppressed) { skipped++; continue; }
      try {
        await prisma.enrollment.upsert({
          where: { contactId_sequenceId: { contactId, sequenceId } },
          create: { contactId, sequenceId, userId: req.user.id, eventId: eventId || null, status: 'active', currentStep: 0, nextSendAt },
          update: { status: 'active', currentStep: 0, nextSendAt },
        });
        enrolled++;
      } catch { skipped++; }
    }
    res.status(201).json({ ok: true, enrolled, skipped });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// PATCH /api/enrollments/:id — pause/resume/cancel
router.patch('/:id', requireAuth, async (req, res) => {
  const { status } = req.body || {};
  const allowed = ['active', 'paused', 'completed'];
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'Invalid status' });
  try {
    const e = await prisma.enrollment.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { status } });
    if (!e.count) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
