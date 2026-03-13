'use strict';

const express = require('express');
const router = express.Router();

const { getPublicEmailSettings, sendMail } = require('../services/mailer');

router.get('/', (req, res) => {
  res.json(getPublicEmailSettings());
});

// Send a real test email to verify SMTP works
router.post('/test', async (req, res) => {
  try {
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ ok: false, error: '`to` is required' });

    await sendMail({
      to,
      subject: 'SMTP test (logical-data-lead-agent)',
      text: 'If you received this, your SMTP configuration is working.',
    });

    res.json({ ok: true, sentTo: to });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
