#!/usr/bin/env node
// Loads both cities' catalogues (scripts/catalog-rows.mjs) into the broker as
// CatalogItem entities, with NGSI-LD batch upsert. Run it again after the
// data changes. Upsert replaces each item as a whole and never deletes: an
// item that left the data stays in the broker until deleted by hand. The page
// keeps a city's list for up to ten minutes after a load.
//
//   node scripts/load-catalog.mjs                  shows what it would write
//   BROKER_API_KEY=… node scripts/load-catalog.mjs --apply
//
// Settings (environment): BROKER_API_KEY (needed for --apply), BROKER_URL and
// BROKER_TENANT (default: as in wrangler.jsonc), BATCH (entities per request, default 100).

import { readFileSync } from 'node:fs';
import { catalogEntities } from './catalog-rows.mjs';

const BROKER_URL = (process.env.BROKER_URL ?? 'https://geolonia-demo.geonicdb.jp').replace(/\/+$/, '');
const TENANT = process.env.BROKER_TENANT ?? 'pointsman_collection';
const CORE_CONTEXT = 'https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld';
const BATCH = Number(process.env.BATCH ?? 100);
if (!Number.isInteger(BATCH) || BATCH < 1 || BATCH > 1000) throw new Error('BATCH must be a whole number from 1 to 1000');
const apply = process.argv.includes('--apply');

const entities = catalogEntities((path) => JSON.parse(readFileSync(path, 'utf8')));
for (const code of ['28204', '28206']) {
  const mine = entities.filter((e) => e.municipality.value === code);
  console.log(`${code}: ${mine.length} items, ${mine.filter((e) => e.collected.value === false).length} not collected as bulky waste`);
}

if (!apply) {
  console.log('\nFirst entity:\n' + JSON.stringify(entities[0], null, 2));
  console.log(`\nNothing written. Add --apply to write to ${BROKER_URL} (tenant ${TENANT}).`);
  process.exit(0);
}

const key = process.env.BROKER_API_KEY;
if (!key) throw new Error('BROKER_API_KEY is not set');
const url = new URL(BROKER_URL);
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('BROKER_URL must be https');

let written = 0;
for (let i = 0; i < entities.length; i += BATCH) {
  const batch = entities.slice(i, i + BATCH);
  let res;
  try {
    res = await fetch(`${BROKER_URL}/ngsi-ld/v1/entityOperations/upsert`, {
      signal: AbortSignal.timeout(60_000),
      method: 'POST',
      headers: {
        'x-api-key': key,
        'NGSILD-Tenant': TENANT,
        'content-type': 'application/json',
        link: `<${CORE_CONTEXT}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`,
        // GeonicDB's firewall refuses requests without a User-Agent.
        'user-agent': 'pointsman-demo-collection (+https://github.com/geolonia/pointsman-demo-collection)',
      },
      body: JSON.stringify(batch),
    });
  } catch (err) {
    throw new Error(`batch at ${i}: ${err.message} (items before it are written; run again to finish)`);
  }
  // 201: all created, 204: all updated, 207: some failed (the body lists them).
  if (res.status === 207) {
    const body = await res.json();
    const errors = body.errors ?? [];
    throw new Error(`batch at ${i}: ${errors.length} failed, first: ${JSON.stringify(errors[0] ?? body).slice(0, 300)}`);
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))).detail ?? '';
    throw new Error(`batch at ${i}: broker answered ${res.status}: ${String(detail).slice(0, 200)}`);
  }
  written += batch.length;
  console.log(`${written} / ${entities.length}`);
}
console.log('done');
