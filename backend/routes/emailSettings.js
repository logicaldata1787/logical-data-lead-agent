'use strict';

const express = require('express');
const router = express.Router();

const { getPublicEmailSettings, sendMail, isDemoMode } = require('../services/mailer');

router.get('/', (req, res) => {
  res.json(getPublicEmailSettings());
});

router.post('/test', async (req, res) => {
  try {
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ ok: false, error: '`to` is required' });

    await sendMail({
      to,
      subject: 'SMTP test (logical-data-lead-agent)',
      text: 'If you received this, your SMTP configuration is working.',
    });

    const response = { ok: true, sentTo: to };
    if (isDemoMode()) response.demo = true;
    res.json(response);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
