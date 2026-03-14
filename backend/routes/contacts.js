'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const prisma = require('../db/prisma');
const { requireAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/contacts
router.get('/', requireAuth, async (req, res) => {
  try {
    const { stage, eventId, companyId, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (stage) where.stage = stage;
    if (eventId) where.eventId = eventId;
    if (companyId) where.companyId = companyId;
    if (search) where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
    ];
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: { company: { select: { id: true, name: true, domain: true } }, event: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.contact.count({ where }),
    ]);
    res.json({ ok: true, contacts, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/contacts/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        company: true, event: true,
        enrollments: { include: { sequence: true } },
        emailMessages: { orderBy: { createdAt: 'desc' }, take: 20 },
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 20 }
      }
    });
    if (!contact) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, contact });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/contacts — create single contact
router.post('/', requireAuth, async (req, res) => {
  try {
    const { email, firstName, lastName, title, companyName, eventId, linkedinUrl, phone, source, notes, tags } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: 'email required' });
    const normalizedEmail = email.toLowerCase().trim();
    // Check suppression
    const suppressed = await prisma.suppression.findUnique({ where: { email: normalizedEmail } });
    if (suppressed) return res.status(409).json({ ok: false, error: 'Email is suppressed/unsubscribed' });
    // Find or create company by domain
    let companyId = null;
    if (companyName) {
      const domain = req.body.domain || extractDomain(normalizedEmail);
      if (domain) {
        const co = await prisma.company.upsert({
          where: { domain },
          create: { name: companyName, domain },
          update: { name: companyName },
        });
        companyId = co.id;
      }
    }
    const contact = await prisma.contact.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, firstName, lastName, title, companyId, companyName, eventId, linkedinUrl, phone, source: source || 'manual', notes, tags: tags || [] },
      update: { firstName, lastName, title, companyId, companyName, eventId, linkedinUrl, phone, notes },
    });
    res.status(201).json({ ok: true, contact });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/contacts/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { email: _e, ...data } = req.body || {};
    if (data.tags && !Array.isArray(data.tags)) data.tags = [];
    const contact = await prisma.contact.update({ where: { id: req.params.id }, data });
    res.json({ ok: true, contact });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/contacts/import-csv — CSV upload (spec-named alias, same handler)
// POST /api/contacts/import — CSV upload (legacy path)
async function handleCsvImport(req, res) {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No file uploaded' });
  try {
    const content = req.file.buffer.toString('utf8');
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    const { eventId } = req.body || {};

    let imported = 0, skipped = 0, errors = [];
    for (const row of rows) {
      try {
        const email = (row.email || row.Email || row.EMAIL || '').toLowerCase().trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped++; continue; }
        // Check suppression
        const suppressed = await prisma.suppression.findUnique({ where: { email } });
        if (suppressed) { skipped++; continue; }
        const firstName = row.first_name || row.firstName || row['First Name'] || '';
        const lastName = row.last_name || row.lastName || row['Last Name'] || '';
        const title = row.title || row.Title || row.job_title || '';
        const companyName = row.company || row.Company || row.company_name || '';
        const domain = row.domain || row.Domain || extractDomain(email);
        const linkedinUrl = row.linkedin_url || row.linkedin || '';
        const source = row.source || 'csv';
        // Upsert company
        let companyId = null;
        if (companyName && domain) {
          const co = await prisma.company.upsert({
            where: { domain },
            create: { name: companyName, domain },
            update: {},
          });
          companyId = co.id;
        }
        await prisma.contact.upsert({
          where: { email },
          create: { email, firstName, lastName, title, companyId, companyName, eventId: eventId || null, linkedinUrl, source, tags: [] },
          update: { firstName: firstName || undefined, lastName: lastName || undefined, title: title || undefined, companyId: companyId || undefined, companyName: companyName || undefined },
        });
        imported++;
      } catch (e) {
        errors.push({ email: row.email, error: e.message });
      }
    }
    res.json({ ok: true, imported, skipped, errors: errors.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

router.post('/import', requireAuth, upload.single('file'), handleCsvImport);
router.post('/import-csv', requireAuth, upload.single('file'), handleCsvImport);

// PATCH /api/contacts/:id/stage — set pipeline stage
router.patch('/:id/stage', requireAuth, async (req, res) => {
  const { stage } = req.body || {};
  const validStages = ['prospect', 'contacted', 'replied', 'qualified', 'closed', 'lost'];
  if (!validStages.includes(stage)) return res.status(400).json({ ok: false, error: 'Invalid stage' });
  try {
    const contact = await prisma.contact.update({ where: { id: req.params.id }, data: { stage } });
    await prisma.activityLog.create({ data: { contactId: req.params.id, userId: req.user.id, type: 'stage_changed', metadata: { stage } } });
    res.json({ ok: true, contact });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function extractDomain(email) {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1].toLowerCase();
}

module.exports = router;
