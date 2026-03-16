'use strict';

const DEFAULT_PERSONAS = [
  'Demand Generation',
  'Marketing Operations',
  'Sales Operations',
  'Revenue Operations',
];

function sanitizeString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized || fallback;
}

function normalizeEventName(eventName) {
  return sanitizeString(eventName, 'Target Event');
}

function inferYear(eventName) {
  const match = String(eventName || '').match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function buildOffer(input = {}) {
  const offer = sanitizeString(input.offer, 'event-based B2B data packages');
  const idealCustomerProfile = sanitizeString(input.idealCustomerProfile, 'B2B teams running outbound campaigns');
  const coverageGoal = sanitizeString(input.coverageGoal, '1,000-5,000 verified contacts');

  return {
    statement: offer,
    idealCustomerProfile,
    coverageGoal,
  };
}

function buildSourcingWorkflow(eventName) {
  return [
    {
      stage: 'discover',
      channels: [
        `Official ${eventName} exhibitor and sponsor pages`,
        'Speaker directory and agenda sessions',
        'LinkedIn attendee conversations and hashtags',
      ],
      output: 'raw_company_targets',
    },
    {
      stage: 'expand',
      channels: [
        'Apollo domain + title prospecting',
        'Company website contact signals and leadership pages',
        'Past edition exhibitor/attendee list matching',
      ],
      output: 'target_contacts',
    },
    {
      stage: 'verify',
      channels: [
        'Email syntax + MX checks',
        'Suppression/unsubscribe filtering',
        'Role and company fit scoring',
      ],
      output: 'ready_to_outreach_contacts',
    },
  ];
}

function buildMultiChannelCadence({ brandName, eventName, offerStatement, targetPersona }) {
  const persona = targetPersona || 'event exhibitors and attendee companies';

  return [
    {
      day: 0,
      channel: 'email',
      objective: 'Introduce value proposition and request permission to share sample',
      template: {
        subject: `{{first_name}}, quick ${eventName} data availability check`,
        body: `Hi {{first_name}},\n\nI help teams activate ${eventName} audiences quickly. ${brandName} provides ${offerStatement} tailored for ${persona}.\n\nWould you like a sample segment by title, region, and company size?\n\nBest,\n{{sender_name}}`,
      },
    },
    {
      day: 2,
      channel: 'linkedin',
      objective: 'Light touch social nudge to increase reply rates',
      script: `Hi {{first_name}} — sharing this because many teams are preparing ${eventName} campaigns. If useful, I can send a short sample audience snapshot.`,
    },
    {
      day: 4,
      channel: 'call',
      objective: 'Qualify timeline and urgency',
      script: `Hi {{first_name}}, this is {{sender_name}} at ${brandName}. Are you building any ${eventName}-aligned target lists this month? If yes, I can share a fast sample and counts.`,
    },
    {
      day: 6,
      channel: 'email',
      objective: 'Share clarity on deliverables and manual handoff process',
      template: {
        subject: `Re: ${eventName} campaign list support`,
        body: `Hi {{first_name}},\n\nIf timing helps, I can send:\n- sample rows\n- expected volume by segment\n- turnaround estimate\n\nPayment and final file delivery are handled manually after scope confirmation.\n\nRegards,\n{{sender_name}}`,
      },
    },
    {
      day: 9,
      channel: 'email',
      objective: 'Close loop respectfully',
      template: {
        subject: `Should I close this for ${eventName}?`,
        body: `Hi {{first_name}},\n\nI have not heard back, so I can close this out for now. If ${eventName} audience data is still relevant, reply with target roles + regions and I will send options.\n\nThanks,\n{{sender_name}}`,
      },
    },
  ];
}

function buildDealDesk() {
  return {
    qualification: [
      'Confirm geography, roles, and company-size filters.',
      'Confirm use case (email outreach, SDR calling, account expansion).',
      'Confirm timeline and required record volume.',
    ],
    negotiation: [
      'Anchor on data quality checks and coverage depth.',
      'Offer tiered packaging (starter/growth/enterprise) by volume.',
      'Set clear turnaround SLA and revision expectations.',
    ],
    closeAndHandoff: [
      'Collect final filter confirmation in writing.',
      'Mark status as closed in CRM/pipeline.',
      'Transition payment and final order delivery to manual team workflow.',
    ],
  };
}

function buildKPIs() {
  return [
    { metric: 'contacts_sourced', target: '500+ per event wave' },
    { metric: 'valid_email_rate', target: '>= 92%' },
    { metric: 'positive_reply_rate', target: '>= 4%' },
    { metric: 'calls_connected_rate', target: '>= 8%' },
    { metric: 'opportunity_to_closed_rate', target: 'track weekly' },
  ];
}

function createLeadGenerationPlan(input = {}) {
  const brandName = sanitizeString(input.brandName, 'Logical Data Solution');
  const website = sanitizeString(input.brandWebsite, 'logicaldatasolution.com');
  const eventName = normalizeEventName(input.eventName || input.prompt || '');
  const targetPersona = sanitizeString(input.targetPersona);
  const year = inferYear(eventName);
  const offer = buildOffer(input);

  return {
    ok: true,
    agent: 'trade-event-revenue-agent',
    brand: { name: brandName, website },
    event: {
      name: eventName,
      year,
      marketType: 'tradeshow/conference/B2B event',
    },
    offer,
    filters: {
      personas: targetPersona ? [targetPersona] : DEFAULT_PERSONAS,
      accountTypes: ['Exhibitors', 'Sponsors', 'Attendee companies'],
      regions: ['North America', 'EMEA', 'APAC'],
      intentSignals: ['Event participation', 'Speaking/session ownership', 'Hiring growth'],
    },
    sourcingWorkflow: buildSourcingWorkflow(eventName),
    outreachCadence: buildMultiChannelCadence({
      brandName,
      eventName,
      offerStatement: offer.statement,
      targetPersona,
    }),
    dealDesk: buildDealDesk(),
    performanceKPIs: buildKPIs(),
    complianceGuardrails: [
      'Target only business-relevant contacts and lawful B2B use cases.',
      'Every outreach message must include an unsubscribe path and suppression checks.',
      'Respect regional communication laws and internal do-not-contact policies.',
    ],
  };
}

module.exports = {
  createLeadGenerationPlan,
  normalizeEventName,
  inferYear,
};
