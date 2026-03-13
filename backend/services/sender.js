'use strict';

const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const prisma = require('../db/prisma');
const { isDemoMode } = require('./mailer');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/email-accounts/oauth/callback';

async function refreshGmailToken(account) {
  if (!GOOGLE_CLIENT_ID) return account;
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  oauth2Client.setCredentials({ refresh_token: account.refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  await prisma.userEmailAccount.update({
    where: { id: account.id },
    data: { accessToken: credentials.access_token, tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null }
  });
  return { ...account, accessToken: credentials.access_token };
}

async function sendViaGmailOAuth(account, { to, subject, html, text }) {
  let acc = account;
  if (!acc.accessToken || (acc.tokenExpiry && new Date() >= new Date(acc.tokenExpiry))) {
    acc = await refreshGmailToken(acc);
  }
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
  oauth2Client.setCredentials({ access_token: acc.accessToken });
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { type: 'OAuth2', user: acc.email, clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, refreshToken: acc.refreshToken, accessToken: acc.accessToken } });
  return transport.sendMail({ from: acc.email, to, subject, html, text });
}

async function sendViaSMTP(account, { to, subject, html, text }) {
  const transport = nodemailer.createTransport({ host: account.smtpHost, port: account.smtpPort || 587, secure: account.smtpSecure || false, auth: { user: account.smtpUser, pass: account.smtpPass } });
  return transport.sendMail({ from: `${account.email} <${account.smtpUser}>`, to, subject, html, text });
}

async function sendEmail(account, payload) {
  if (isDemoMode()) {
    console.log(`DEMO_MODE: simulate send | from=${account.email} to=${payload.to} subject="${payload.subject}"`);
    return { demo: true, accepted: [payload.to] };
  }
  if (account.type === 'gmail_oauth') return sendViaGmailOAuth(account, payload);
  return sendViaSMTP(account, payload);
}

module.exports = { sendEmail };
