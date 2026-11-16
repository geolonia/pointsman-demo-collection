#!/usr/bin/env node
// Creates (or updates in place) the broker subscriptions that send bookings
// to the Worker's bridge: new and changed bookings to the intake route
// (/notify), and bookings with an intake result to the slot route
// (/notify?route=slot). Run once, and again after the inputs change.
//
//   BROKER_API_KEY=… NOTIFY_SECRET=… node scripts/setup.mjs
//
// NOTIFY_SECRET must be the Worker's secret of the same name. WORKER_URL
// (default the custom domain) is where the broker sends notifications: for
// your own deployment, set it to your Worker's address, or the bookings and
// NOTIFY_SECRET go to the public demo.

import { readFileSync } from 'node:fs';

const config = readFileSync('wrangler.jsonc', 'utf8');
const varOf = (name) => {
  const m = config.match(new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`));
  if (!m) throw new Error(`wrangler.jsonc has no ${name}`);
  return m[1];
};
const BROKER_URL = varOf('BROKER_URL').replace(/\/+$/, '');
const TENANT = varOf('BROKER_TENANT');
const WORKER_URL = process.env.WORKER_URL ?? 'https://collection.demo.pointsman.net';
const { BROKER_API_KEY, NOTIFY_SECRET } = process.env;
if (!BROKER_API_KEY || !NOTIFY_SECRET) throw new Error('set BROKER_API_KEY and NOTIFY_SECRET');

const CORE_CONTEXT = 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld';
const headers = {
  'x-api-key': BROKER_API_KEY,
  'NGSILD-Tenant': TENANT,
  'content-type': 'application/json',
  link: `<${CORE_CONTEXT}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`,
  // GeonicDB's firewall refuses requests without a User-Agent.
  'user-agent': 'pointsman-demo-collection (+https://github.com/geolonia/pointsman-demo-collection)',
};
const base = `${BROKER_URL}/ngsi-ld/v1`;
const endpoint = (path) => ({ uri: `${WORKER_URL}${path}`, accept: 'application/json', receiverInfo: [{ key: 'x-bridge-secret', value: NOTIFY_SECRET }] });
const subscriptions = {
  'urn:ngsi-ld:Subscription:pointsman-demo-collection-intake': {
    description: 'Pointsman collection demo: new and changed bookings to the intake route',
    entities: [{ type: 'ServiceRequest' }],
    // The inputs of bulky-waste-intake (src/requests.ts INTAKE_INPUTS).
    watchedAttributes: ['itemKinds', 'maxItemKinds', 'notCollectedCount', 'carryOut'],
    notification: { format: 'normalized', endpoint: endpoint('/notify') },
  },
  'urn:ngsi-ld:Subscription:pointsman-demo-collection-slot': {
    description: 'Pointsman collection demo: bookings with an intake result, to the slot route',
    entities: [{ type: 'ServiceRequest' }],
    // Only bookings the intake has decided (attribute exists).
    q: 'intake',
    // The inputs of bulky-waste-slot (src/requests.ts SLOT_INPUTS).
    watchedAttributes: ['dateNeed', 'slotCosts', 'intake'],
    notification: { format: 'normalized', endpoint: endpoint('/notify?route=slot') },
  },
};

for (const [id, subscription] of Object.entries(subscriptions)) {
  // Update in place, so notifications never stop; create it when missing.
  let res = await fetch(`${base}/subscriptions/${encodeURIComponent(id)}`, { method: 'PATCH', headers, body: JSON.stringify(subscription) });
  if (res.status === 404) {
    res = await fetch(`${base}/subscriptions`, { method: 'POST', headers, body: JSON.stringify({ id, type: 'Subscription', ...subscription }) });
  }
  // Only the status: the body may echo the request, secret included.
  console.log(`subscription ${id}: ${res.status}`);
  if (!res.ok) process.exit(1);
}
