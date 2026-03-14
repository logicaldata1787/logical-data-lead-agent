'use strict';

const crypto = require('crypto');
const prisma = require('../db/prisma');
const { sendEmail } = require('./sender');
const { isDemoMode } = require('./mailer');

const UNSUBSCRIBE_BASE = process.env.APP_URL || process.env.RAILWAY_STATIC_URL || 'http://localhost:3000';

function personalize(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}

const MAILING_ADDRESS = process.env.MAILING_ADDRESS || '[Company Name, 123 Main St, City, ST 00000, USA]';

function addUnsubscribeFooter(html, token) {
  const link = `${UNSUBSCRIBE_BASE}/unsubscribe?token=${token}`;
  return html + `\n\n<p style="font-size:12px;color:#888;">Don't want to receive these emails? <a href="${link}">Unsubscribe</a><br>${MAILING_ADDRESS}</p>`;
}

async function processEnrollments() {
  const now = new Date();
  try {
    const due = await prisma.enrollment.findMany({
      where: { status: 'active', nextSendAt: { lte: now } },
      include: {
        contact: true,
        sequence: { include: { steps: { orderBy: { stepNumber: 'asc' } } } },
        user: { include: { emailAccounts: true } },
        event: true,
      }
    });

    for (const enrollment of due) {
      try {
        const { contact, sequence, user } = enrollment;
        if (!contact || contact.doNotContact || contact.unsubscribed) {
          await prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: 'completed' } });
          continue;
        }
        // Check suppression
        const suppressed = await prisma.suppression.findUnique({ where: { email: contact.email } });
        if (suppressed) {
          await prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: 'unsubscribed' } });
          continue;
        }
        const steps = sequence.steps;
        const stepIndex = enrollment.currentStep;
        if (stepIndex >= steps.length) {
          await prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: 'completed' } });
          continue;
        }
        const step = steps[stepIndex];
        // Get email account
        const account = user.emailAccounts?.[0];
        if (!account && !isDemoMode()) {
          console.warn(`No email account for user ${user.id}, skipping enrollment ${enrollment.id}`);
          continue;
        }
        // Check daily limit
        if (account && !isDemoMode()) {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const sentToday = await prisma.emailMessage.count({ where: { emailAccountId: account.id, sentAt: { gte: today }, status: { in: ['sent', 'simulated'] } } });
          if (sentToday >= (account.dailyLimit || 200)) {
            console.log(`Daily limit reached for account ${account.email}, deferring`);
            continue;
          }
        }
        // Personalize
        const vars = {
          first_name: contact.firstName || '',
          last_name: contact.lastName || '',
          company: contact.companyName || '',
          title: contact.title || '',
          event_name: enrollment.event?.name || '',
        };
        const subject = personalize(step.subject, vars);
        const bodyHtml = personalize(step.body, vars);
        // Generate unsubscribe token
        const token = crypto.randomBytes(24).toString('hex');
        await prisma.suppression.upsert({ where: { email: contact.email }, create: { email: contact.email, token, reason: null }, update: {} }).catch((err) => console.error('Suppression upsert error:', err.message));
        const supp = await prisma.suppression.findUnique({ where: { email: contact.email } });
        const html = addUnsubscribeFooter(bodyHtml, supp?.token || token);
        // Send
        const msg = await prisma.emailMessage.create({ data: { enrollmentId: enrollment.id, contactId: contact.id, sequenceStepId: step.id, emailAccountId: account?.id, subject, body: html, status: 'scheduled' } });
        let status = 'sent', sentAt = new Date();
        try {
          if (account) await sendEmail(account, { to: contact.email, subject, html });
          else { console.log(`DEMO (no account): to=${contact.email} subject="${subject}"`); status = 'simulated'; }
          if (isDemoMode()) status = 'simulated';
        } catch (e) {
          status = 'failed';
          console.error(`Email send error for ${contact.email}:`, e.message);
        }
        await prisma.emailMessage.update({ where: { id: msg.id }, data: { status, sentAt: status !== 'failed' ? sentAt : undefined } });
        // Update contact stage
        if (contact.stage === 'prospect') await prisma.contact.update({ where: { id: contact.id }, data: { stage: 'contacted' } });
        // Advance enrollment
        const nextStep = stepIndex + 1;
        if (nextStep >= steps.length) {
          await prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: 'completed', currentStep: nextStep } });
        } else {
          const nextDelay = steps[nextStep].delayDays || 1;
          const nextSendAt = new Date();
          nextSendAt.setDate(nextSendAt.getDate() + nextDelay);
          nextSendAt.setHours(9, 0, 0, 0);
          await prisma.enrollment.update({ where: { id: enrollment.id }, data: { currentStep: nextStep, nextSendAt } });
        }
        await prisma.activityLog.create({ data: { contactId: contact.id, userId: user.id, type: 'email_sent', metadata: { subject, step: stepIndex + 1, sequenceId: sequence.id } } });
      } catch (err) {
        console.error(`Error processing enrollment ${enrollment.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Worker error:', err.message);
  }
}

function startWorker(intervalMs = 60000) {
  console.log(`Email worker started (interval: ${intervalMs}ms)`);
  setInterval(processEnrollments, intervalMs);
  // Run immediately on start
  setTimeout(processEnrollments, 5000);
}

module.exports = { startWorker, processEnrollments, personalize, addUnsubscribeFooter };
