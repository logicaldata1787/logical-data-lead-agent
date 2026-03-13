'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { requireAuth } = require('../middleware/auth');
const apolloService = require('../services/apollo');

// POST /api/apollo/search — search for people
router.post('/search', requireAuth, async (req, res) => {
  const { domains = [], titles = ['Sales', 'Marketing', 'Business Development', 'VP', 'Director', 'Head of'], page = 1, perPage = 25 } = req.body || {};
  if (!domains.length) return res.status(400).json({ ok: false, error: 'domains required' });
  try {
    const result = await apolloService.searchPeople({ domains, titles, page, perPage });
    res.json({ ok: true, result });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// POST /api/apollo/import — import Apollo results as contacts
router.post('/import', requireAuth, async (req, res) => {
  const { people = [], eventId } = req.body || {};
  if (!people.length) return res.status(400).json({ ok: false, error: 'people array required' });
  let imported = 0, skipped = 0;
  for (const p of people) {
    try {
      const email = p.email;
      // Apollo often doesn't return emails directly — mark for enrichment
      if (!email) {
        await prisma.contact.create({ data: {
          email: `apollo_${p.id || Date.now()}_pending@pending.invalid`,
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          title: p.title || '',
          companyName: p.organization?.name || '',
          apolloId: p.id || null,
          source: 'apollo',
          stage: 'prospect',
          tags: ['needs_email_enrichment'],
          eventId: eventId || null,
        }}).catch(() => {});
        imported++;
        continue;
      }
      const suppressed = await prisma.suppression.findUnique({ where: { email: email.toLowerCase() } });
      if (suppressed) { skipped++; continue; }
      const domain = email.split('@')[1] || p.organization?.website_url;
      let companyId = null;
      if (p.organization?.name && domain) {
        const co = await prisma.company.upsert({ where: { domain }, create: { name: p.organization.name, domain }, update: {} });
        companyId = co.id;
      }
      await prisma.contact.upsert({
        where: { email: email.toLowerCase() },
        create: { email: email.toLowerCase(), firstName: p.first_name || '', lastName: p.last_name || '', title: p.title || '', companyId, companyName: p.organization?.name || '', apolloId: p.id || null, source: 'apollo', stage: 'prospect', tags: [], eventId: eventId || null },
        update: { firstName: p.first_name || undefined, lastName: p.last_name || undefined, title: p.title || undefined },
      });
      imported++;
    } catch { skipped++; }
  }
  res.json({ ok: true, imported, skipped });
});

module.exports = router;
