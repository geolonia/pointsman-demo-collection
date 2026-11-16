#!/usr/bin/env node
// A stand-in for the broker, for local development without a GeonicDB
// tenant: answers the NGSI-LD requests the Worker makes, in memory. It starts
// with the catalogue (data/<city>/items.json, as scripts/load-catalog.mjs
// would write it). About two seconds after a booking is created, it writes
// the intake result as the bridge would, and two seconds later the slot
// result, with the rules of bulky-waste-intake v1 and bulky-waste-slot v1
// (profiles/), so the page's whole flow can be tried without Pointsman.
//
//   node scripts/mock-broker.mjs            (port 8790, or PORT)
//   printf 'BROKER_URL=http://localhost:8790\nBROKER_API_KEY=local\nPOINTSMAN_TOKEN=local\nNOTIFY_SECRET=local\n' > .dev.vars; pnpm dev

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { catalogEntities } from './catalog-rows.mjs';

const PORT = Number(process.env.PORT ?? 8790);
const entities = new Map(catalogEntities((path) => JSON.parse(readFileSync(path, 'utf8'))).map((e) => [e.id, e]));

const P = (value) => ({ type: 'Property', value });
const v = (e, name) => e[name]?.value;

/** bulky-waste-intake v1: [rule index or "default", action]. */
function intake(e) {
  const [kinds, max, not, carry] = [v(e, 'itemKinds'), v(e, 'maxItemKinds'), v(e, 'notCollectedCount'), v(e, 'carryOut')];
  if (typeof kinds !== 'number' || typeof not !== 'number' || typeof carry !== 'boolean') return ['0', 'review'];
  if (not > 0) return ['1', 'redirect'];
  if (kinds < 1) return ['2', 'ask'];
  if (typeof max === 'number' && kinds > max) return ['3', 'ask'];
  if (carry) return ['4', 'review'];
  return ['default', 'plan'];
}

/** bulky-waste-slot v1. */
function slot(e, intakeAction) {
  const need = v(e, 'dateNeed');
  const c = v(e, 'slotCosts') ?? {};
  if (intakeAction !== 'plan') return ['0', 'hold'];
  if (typeof need !== 'string' || typeof c.wishedFeasible !== 'boolean' || typeof c.bestFound !== 'boolean') return ['1', 'review'];
  if (need === 'any' && c.bestFound && c.bestExtraMin <= 20) return ['2', 'assign_best'];
  if (c.wishedFeasible && c.wishedExtraMin <= 15) return ['3', 'accept'];
  if (need === 'fixed' && c.wishedFeasible) return ['4', 'accept'];
  if (c.bestFound) return ['5', 'offer_days'];
  return ['default', 'review'];
}

let generation = 0;
const generations = new Map();

function result(id, attribute, profile, [rule, action]) {
  const decisionId = crypto.randomUUID();
  const decision = `urn:ngsi-ld:Decision:${decisionId}`;
  entities.set(decision, { id: decision, type: 'Decision', note: P('made by scripts/mock-broker.mjs, not by Pointsman') });
  const e = entities.get(id);
  entities.set(id, { ...e, [attribute]: { type: 'Property', value: action, decisionId: P(decisionId), decision: { type: 'Relationship', object: decision }, profile: P(profile), policyRule: P(rule), model: P('none') } });
  return action;
}

/** Writes the results about 2 and 4 s later, only to the booking as created now. */
function decideLater(id, gen) {
  const alive = () => entities.has(id) && generations.get(id) === gen;
  setTimeout(() => {
    if (!alive()) return;
    const action = result(id, 'intake', 'bulky-waste-intake', intake(entities.get(id)));
    setTimeout(() => {
      if (alive()) result(id, 'slot', 'bulky-waste-slot', slot(entities.get(id), action));
    }, 2000);
  }, 2000);
}

/** The few NGSI-LD q forms the Worker sends: name=="value". */
function matches(e, q) {
  if (!q) return true;
  const m = /^(\w+)=="([^"]*)"$/.exec(q);
  return !!m && v(e, m[1]) === m[2];
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  let text = '';
  req.on('data', (c) => { text += c; });
  req.on('end', () => {
    let body;
    if (text) {
      try { body = JSON.parse(text); } catch { return send(400, { title: 'not JSON' }); }
    }
    if (url.pathname === '/ngsi-ld/v1/entities' && req.method === 'POST') {
      const e = body;
      if (!e || typeof e !== 'object' || Array.isArray(e) || typeof e.id !== 'string' || typeof e.type !== 'string') return send(400, { title: 'not an entity' });
      if (entities.has(e.id)) return send(409, { title: 'exists' });
      const gen = ++generation;
      entities.set(e.id, { ...e, createdAt: new Date().toISOString() });
      generations.set(e.id, gen);
      if (e.type === 'ServiceRequest') decideLater(e.id, gen);
      return send(201);
    }
    if (url.pathname === '/ngsi-ld/v1/entityOperations/upsert' && req.method === 'POST') {
      if (!Array.isArray(body)) return send(400, { title: 'not a list' });
      for (const e of body) entities.set(e.id, e);
      return send(204);
    }
    if (url.pathname === '/ngsi-ld/v1/entities' && req.method === 'GET') {
      const type = url.searchParams.get('type');
      const q = url.searchParams.get('q');
      const all = [...entities.values()].filter((e) => (!type || e.type === type) && matches(e, q));
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 1000);
      return send(200, all.slice(offset, offset + limit), url.searchParams.get('count') === 'true' ? { 'NGSILD-Results-Count': String(all.length) } : {});
    }
    const m = url.pathname.match(/^\/ngsi-ld\/v1\/entities\/([^/]+)(\/attrs)?$/);
    let id;
    try { id = m ? decodeURIComponent(m[1]) : undefined; } catch { return send(400, { title: 'bad id' }); }
    if (id && m[2] && req.method === 'PATCH') {
      const e = entities.get(id);
      if (!e) return send(404, { title: 'not found' });
      entities.set(id, { ...e, ...body });
      return send(204);
    }
    if (id && !m[2] && req.method === 'GET') {
      const one = entities.get(id);
      return one ? send(200, one) : send(404, { title: 'not found' });
    }
    if (id && !m[2] && req.method === 'DELETE') return send(entities.delete(id) ? 204 : 404);
    return send(405);
  });
}).listen(PORT, () => console.log(`mock broker: http://localhost:${PORT} (${entities.size} catalogue items)`));
