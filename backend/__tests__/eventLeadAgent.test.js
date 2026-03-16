'use strict';

const {
  createLeadGenerationPlan,
  normalizeEventName,
  inferYear,
} = require('../services/eventLeadAgent');

describe('eventLeadAgent', () => {
  test('normalizeEventName trims and collapses whitespace', () => {
    expect(normalizeEventName('  SaaStr   Annual   2027 ')).toBe('SaaStr Annual 2027');
  });

  test('inferYear extracts year when present', () => {
    expect(inferYear('Web Summit 2026')).toBe(2026);
  });

  test('inferYear returns null when absent', () => {
    expect(inferYear('Dreamforce')).toBeNull();
  });

  test('createLeadGenerationPlan returns enriched workflow', () => {
    const plan = createLeadGenerationPlan({
      eventName: 'CES 2026',
      brandName: 'Logical Data Solution',
      offer: 'verified attendee and exhibitor contacts',
      idealCustomerProfile: 'B2B agencies and SaaS firms',
      coverageGoal: '2500 contacts',
    });

    expect(plan.ok).toBe(true);
    expect(plan.agent).toBe('trade-event-revenue-agent');
    expect(plan.event.name).toBe('CES 2026');
    expect(plan.event.year).toBe(2026);
    expect(plan.sourcingWorkflow).toHaveLength(3);
    expect(plan.outreachCadence).toHaveLength(5);
    expect(plan.outreachCadence[2].channel).toBe('call');
    expect(plan.offer.idealCustomerProfile).toBe('B2B agencies and SaaS firms');
    expect(plan.performanceKPIs.length).toBeGreaterThan(2);
  });
});
