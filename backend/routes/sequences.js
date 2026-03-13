'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { requireAuth } = require('../middleware/auth');

// Sequences CRUD
router.get('/', requireAuth, async (req, res) => {
  try {
    const sequences = await prisma.sequence.findMany({
      where: { userId: req.user.id },
      include: { steps: { orderBy: { stepNumber: 'asc' } }, _count: { select: { enrollments: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ ok: true, sequences });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const seq = await prisma.sequence.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { steps: { orderBy: { stepNumber: 'asc' } } }
    });
    if (!seq) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, sequence: seq });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  const { name, description, steps } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: 'name required' });
  try {
    const seq = await prisma.sequence.create({
      data: {
        name, description, userId: req.user.id,
        steps: steps && steps.length ? {
          create: steps.map((s, i) => ({ stepNumber: i + 1, subject: s.subject, body: s.body, delayDays: s.delayDays || 0 }))
        } : undefined,
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } }
    });
    res.status(201).json({ ok: true, sequence: seq });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name, description, isActive } = req.body || {};
  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (isActive !== undefined) data.isActive = isActive;
    const seq = await prisma.sequence.updateMany({ where: { id: req.params.id, userId: req.user.id }, data });
    if (!seq.count) return res.status(404).json({ ok: false, error: 'Not found' });
    const updated = await prisma.sequence.findUnique({ where: { id: req.params.id }, include: { steps: { orderBy: { stepNumber: 'asc' } } } });
    res.json({ ok: true, sequence: updated });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await prisma.sequence.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Steps sub-routes
router.post('/:id/steps', requireAuth, async (req, res) => {
  const { subject, body, delayDays, stepNumber } = req.body || {};
  if (!subject || !body) return res.status(400).json({ ok: false, error: 'subject and body required' });
  try {
    const seq = await prisma.sequence.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!seq) return res.status(404).json({ ok: false, error: 'Sequence not found' });
    const count = await prisma.sequenceStep.count({ where: { sequenceId: req.params.id } });
    const step = await prisma.sequenceStep.create({ data: { sequenceId: req.params.id, stepNumber: stepNumber || count + 1, subject, body, delayDays: delayDays || 0 } });
    res.status(201).json({ ok: true, step });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.put('/:id/steps/:stepId', requireAuth, async (req, res) => {
  const { subject, body, delayDays } = req.body || {};
  try {
    const step = await prisma.sequenceStep.update({ where: { id: req.params.stepId }, data: { subject, body, delayDays } });
    res.json({ ok: true, step });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.delete('/:id/steps/:stepId', requireAuth, async (req, res) => {
  try {
    await prisma.sequenceStep.delete({ where: { id: req.params.stepId } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Replace all steps at once
router.put('/:id/steps', requireAuth, async (req, res) => {
  const { steps } = req.body || {};
  if (!Array.isArray(steps)) return res.status(400).json({ ok: false, error: 'steps array required' });
  try {
    const seq = await prisma.sequence.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!seq) return res.status(404).json({ ok: false, error: 'Not found' });
    await prisma.sequenceStep.deleteMany({ where: { sequenceId: req.params.id } });
    await prisma.sequenceStep.createMany({ data: steps.map((s, i) => ({ sequenceId: req.params.id, stepNumber: i + 1, subject: s.subject, body: s.body, delayDays: s.delayDays || 0 })) });
    const updated = await prisma.sequence.findUnique({ where: { id: req.params.id }, include: { steps: { orderBy: { stepNumber: 'asc' } } } });
    res.json({ ok: true, sequence: updated });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
