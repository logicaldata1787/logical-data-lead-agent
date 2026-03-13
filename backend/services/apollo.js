'use strict';

/**
 * Apollo.io People Search service wrapper.
 * Docs: https://docs.apollo.io/reference/people-api-search
 */

const https = require('https');

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.apollo.io',
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-cache', 'X-Api-Key': APOLLO_API_KEY },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid Apollo response')); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Search people on Apollo by domain and/or titles.
 * Returns raw Apollo response.
 */
async function searchPeople({ domains = [], titles = [], page = 1, perPage = 25 } = {}) {
  if (!APOLLO_API_KEY) throw new Error('APOLLO_API_KEY not configured');
  const body = { api_key: APOLLO_API_KEY, q_organization_domains: domains.join('\n'), person_titles: titles, page, per_page: perPage };
  return post('/v1/mixed_people/search', body);
}

/**
 * Enrich a single person by email.
 */
async function enrichPerson({ email, firstName, lastName, domain } = {}) {
  if (!APOLLO_API_KEY) throw new Error('APOLLO_API_KEY not configured');
  const body = { api_key: APOLLO_API_KEY, reveal_personal_emails: false };
  if (email) body.email = email;
  if (firstName) body.first_name = firstName;
  if (lastName) body.last_name = lastName;
  if (domain) body.organization_domain = domain;
  return post('/v1/people/match', body);
}

module.exports = { searchPeople, enrichPerson };
