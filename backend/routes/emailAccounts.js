'use strict';

const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { requireAuth } = require('../middleware/auth');
const { google } = require('googleapis');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/email-accounts/oauth/callback';

function getOAuthClient() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

// GET /api/email-accounts
router.get('/', requireAuth, async (req, res) => {
  try {
    const accounts = await prisma.userEmailAccount.findMany({
      where: { userId: req.user.id },
      select: { id: true, type: true, email: true, dailyLimit: true, createdAt: true, smtpHost: true, smtpPort: true, smtpUser: true }
    });
    res.json({ ok: true, accounts });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/email-accounts/oauth/url — get Gmail OAuth URL
router.get('/oauth/url', requireAuth, (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ ok: false, error: 'GOOGLE_CLIENT_ID not configured' });
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
    prompt: 'consent',
    state: req.user.id,
  });
  res.json({ ok: true, url });
});

// GET /api/email-accounts/oauth/callback — handle OAuth callback
router.get('/oauth/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code || !userId) return res.status(400).send('Missing code or state');
  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    await prisma.userEmailAccount.upsert({
      where: { userId_email: { userId, email: data.email } },
      create: { userId, type: 'gmail_oauth', email: data.email, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null },
      update: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token || undefined, tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null },
    });
    const fe = process.env.FRONTEND_URL || '';
    res.redirect(`${fe}/#/email-accounts?connected=1`);
  } catch (err) {
    res.status(500).send('OAuth error: ' + err.message);
  }
});

// POST /api/email-accounts/smtp — add SMTP account
router.post('/smtp', requireAuth, async (req, res) => {
  const { email, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, dailyLimit } = req.body || {};
  if (!email || !smtpHost || !smtpUser || !smtpPass) return res.status(400).json({ ok: false, error: 'email, smtpHost, smtpUser, smtpPass required' });
  try {
    const account = await prisma.userEmailAccount.upsert({
      where: { userId_email: { userId: req.user.id, email } },
      create: { userId: req.user.id, type: 'smtp', email, smtpHost, smtpPort: smtpPort || 587, smtpSecure: smtpSecure || false, smtpUser, smtpPass, dailyLimit: dailyLimit || 200 },
      update: { smtpHost, smtpPort: smtpPort || 587, smtpSecure: smtpSecure || false, smtpUser, smtpPass, dailyLimit: dailyLimit || 200 },
    });
    res.json({ ok: true, account: { id: account.id, type: account.type, email: account.email, dailyLimit: account.dailyLimit } });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// DELETE /api/email-accounts/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await prisma.userEmailAccount.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

module.exports = router;
