'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createLeadGenerationPlan } = require('../services/eventLeadAgent');

router.post('/event-plan', requireAuth, async (req, res) => {
  const {
    eventName,
    prompt,
    targetPersona,
    offer,
    idealCustomerProfile,
    coverageGoal,
  } = req.body || {};

  const resolvedEventName = typeof eventName === 'string' && eventName.trim()
    ? eventName
    : prompt;

  if (!resolvedEventName || typeof resolvedEventName !== 'string' || !resolvedEventName.trim()) {
    return res.status(400).json({ ok: false, error: 'eventName (or prompt) is required' });
  }

  const plan = createLeadGenerationPlan({
    eventName: resolvedEventName,
    targetPersona,
    offer,
    idealCustomerProfile,
    coverageGoal,
    brandName: 'Logical Data Solution',
    brandWebsite: 'logicaldatasolution.com',
  });

  return res.json(plan);
});

module.exports = router;
