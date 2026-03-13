'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');

// GET /unsubscribe?token=xxx  (public, no auth)
router.get('/', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('<h2>Invalid unsubscribe link</h2>');
  try {
    const supp = await prisma.suppression.findUnique({ where: { token } });
    if (!supp) return res.status(404).send('<h2>Link not found or already processed</h2>');
    // Mark suppression with reason
    await prisma.suppression.update({ where: { token }, data: { reason: 'unsubscribe' } });
    // Mark contact
    await prisma.contact.updateMany({ where: { email: supp.email }, data: { unsubscribed: true, stage: 'lost' } });
    // Complete any active enrollments
    const contacts = await prisma.contact.findMany({ where: { email: supp.email } });
    for (const c of contacts) {
      await prisma.enrollment.updateMany({ where: { contactId: c.id, status: 'active' }, data: { status: 'unsubscribed' } });
    }
    res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:4rem;"><h2>✅ You've been unsubscribed</h2><p>You will no longer receive emails from us at <strong>${supp.email}</strong>.</p></body></html>`);
  } catch (err) {
    res.status(500).send('<h2>Error processing unsubscribe</h2>');
  }
});

// POST /api/unsubscribe — manual unsubscribe
router.post('/', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, error: 'email required' });
  try {
    const crypto = require('crypto');
    const token = crypto.randomBytes(24).toString('hex');
    await prisma.suppression.upsert({ where: { email }, create: { email, token, reason: 'unsubscribe' }, update: { reason: 'unsubscribe' } });
    await prisma.contact.updateMany({ where: { email }, data: { unsubscribed: true } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
