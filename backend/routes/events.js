'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const events = await prisma.event.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { contacts: true } } } });
    res.json({ ok: true, events });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id }, include: { contacts: { take: 20 } } });
    if (!event) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, event });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  const { name, website, location, startDate, endDate, notes } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: 'name required' });
  try {
    const event = await prisma.event.create({ data: { name, website, location, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, notes } });
    res.status(201).json({ ok: true, event });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name, website, location, startDate, endDate, notes } = req.body || {};
  try {
    const data = {};
    if (name !== undefined) data.name = name;
    if (website !== undefined) data.website = website;
    if (location !== undefined) data.location = location;
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (notes !== undefined) data.notes = notes;
    const event = await prisma.event.update({ where: { id: req.params.id }, data });
    res.json({ ok: true, event });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
