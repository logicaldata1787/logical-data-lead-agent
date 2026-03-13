'use strict';

const nodemailer = require('nodemailer');

function providerDefaults(provider) {
  switch ((provider || '').toLowerCase()) {
    case 'gmail':
      return { host: 'smtp.gmail.com', port: 465, secure: true };
    case 'outlook':
      return { host: 'smtp.office365.com', port: 587, secure: false };
    default:
      return { host: undefined, port: 587, secure: false };
  }
}

function getConfig() {
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
  const defaults = providerDefaults(provider);

  const host = process.env.SMTP_HOST || defaults.host;
  const port = Number(process.env.SMTP_PORT || defaults.port);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? String(process.env.SMTP_SECURE) === 'true'
      : defaults.secure;

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user;

  return { provider, host, port, secure, user, pass, from };
}

function getPublicEmailSettings() {
  const cfg = getConfig();
  return {
    provider: cfg.provider,
    smtpHost: cfg.host || '',
    smtpPort: cfg.port,
    smtpSecure: cfg.secure,
    mailFrom: cfg.from || '',
    smtpUser: cfg.user ? maskEmail(cfg.user) : '',
    configured: Boolean(cfg.user && process.env.SMTP_PASS && (cfg.host || cfg.provider !== 'smtp')),
  };
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}

function createTransport() {
  const cfg = getConfig();

  if (!cfg.user || !cfg.pass) {
    throw new Error('Missing SMTP_USER or SMTP_PASS in environment variables.');
  }
  if (!cfg.host) {
    throw new Error('Missing SMTP_HOST (or set EMAIL_PROVIDER to gmail/outlook).');
  }

  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

async function sendMail({ to, subject, text, html }) {
  const cfg = getConfig();
  const transport = createTransport();
  return transport.sendMail({
    from: cfg.from,
    to,
    subject,
    text,
    html,
  });
}

module.exports = {
  getPublicEmailSettings,
  sendMail,
};
