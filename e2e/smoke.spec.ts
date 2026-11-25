// Smoke tests: the page loads on the real Worker, its main controls work,
// and bookings go from the address search to their result: a day offered and
// chosen, and items the city does not collect. Endpoints that need the broker,
// Pointsman or GSI are stubbed here (playwright.config.ts says why); GET
// /api/config and the page's files come from the Worker itself. The stubs do
// what the Worker does, with its own functions: the cities and areas, the
// real catalogues in data/, the route costs and the booking entity, and the
// bridge's own functions for what it writes. Only the geocoder's answer and
// Pointsman's decisions are written here. They are set by each test: the
// tests check what the page sends and shows, not how Pointsman decides.
// Other hosts (map tiles, MapLibre) are blocked: the address search works
// without the map.

import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';
import { fromCatalogEntity, type CatalogItem } from '../src/catalog';
import { areaOf, cityByCode, WINDOW_DAYS } from '../src/cities';
import { collectionDays, dayCosts, SERVICE_MIN, SERVICE_TWO_PERSON_MIN, summarize, todayJst } from '../src/plan';
import { type Costs, dayOf, type Line, parseBooking, tally, toRequestEntity } from '../src/requests';
import { INTAKE_ROUTE, SLOT_ROUTE } from '../src/routes';
import { isChecked, toDecisionEntity, toProperty, type Route } from '../engine/packages/fiware/src/bridge';
// @ts-expect-error plain JavaScript without types: the loader of scripts/load-catalog.mjs
import { catalogEntities } from '../scripts/catalog-rows.mjs';

const NISHINOMIYA = '28204';
// A town in Nishinomiya's southern area, and a point in it (GSI's address search would find it).
const TOWN = '甲子園口北町';
const AT: [number, number] = [135.37311, 34.74305];
const IRONING_BOARD = 'urn:ngsi-ld:CatalogItem:28204:i-b1fa7eff4cca';
const APPLIANCES = 'urn:ngsi-ld:CatalogItem:28204:x-9c2e0a2e5fc8';

/** Both cities' catalogues, as scripts/load-catalog.mjs loads them into the broker, read back as the Worker does. */
const catalogue = (catalogEntities((path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))) as Parameters<typeof fromCatalogEntity>[0][])
  .map(fromCatalogEntity).filter((i): i is CatalogItem => i !== null);

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date().toISOString();

/** A decision as Pointsman returns it to the bridge. */
type Decision = Parameters<typeof toProperty>[0];

/** Pointsman's decision for one route. `rule`: the index of the rule that matched, null for the default action. */
function decision(n: number, route: Route, action: string, rule: number | null): Decision {
  return { decision_id: uuid(n), action, profile: route.profile, profile_version: 1, model: 'rules', answers: {}, created_at: NOW, rule };
}

/**
 * What the bridge writes for a decision: the result attribute on the booking,
 * and the Decision entity as the Worker reads it back from the broker
 * (without a context: the Decision model's terms come back as full IRIs).
 */
function written(d: Decision, route: Route, requestId: string) {
  const entity = toDecisionEntity(d, requestId, route, new Date(NOW));
  const stored: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entity)) {
    if (k !== '@context') stored[k === 'answers' || k === 'facts' ? `https://datamodels.jp/ns/decision/${k}` : k] = v;
  }
  return { attribute: toProperty(d, 'test-input-hash', new Date(NOW), String(entity.id), isChecked(d, route)), entity: stored };
}

/** What Pointsman decides for a booking, in a test: the intake, then the day (only after "plan"). */
interface Outcome {
  intake: { action: string; rule: number | null };
  slot?: { action: string; rule: number | null };
}

/** Uncaught errors, console errors, and failed loads or error answers from the page's own origin. */
function collectErrors(page: Page): string[] {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Failed loads are caught below by origin; the blocked hosts' ones do not count.
    if (/Failed to load resource|net::ERR_/.test(m.text())) return;
    errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (new URL(r.url()).origin === origin && r.status() >= 400) errors.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    if (new URL(r.url()).origin === origin) errors.push(`failed: ${r.method()} ${r.url()} ${r.failure()?.errorText ?? ''}`);
  });
  return errors;
}

/** Every test fails on the errors above, whatever it does on the page. */
const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [async ({ page }, use) => {
    const errors = collectErrors(page);
    await use(errors);
    expect(errors, 'errors on the page').toEqual([]);
  }, { auto: true }],
});

/**
 * Stubs GSI's address search and the endpoints behind which the broker,
 * Pointsman or GSI's geocoder sit, and blocks other hosts. A booking the page
 * sends becomes the entity the Worker would create from it (createRequest in
 * src/index.ts, with no other bookings yet); `outcome` is what Pointsman then
 * writes on it. Returns what the page sent.
 */
async function stubServices(page: Page, outcome?: Outcome) {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const sent: { bookings: unknown[]; days: unknown[] } = { bookings: [], days: [] };
  let booking: Record<string, unknown> | null = null;
  let chosen: string | null = null;
  await page.route((url) => url.origin !== origin, (route) => route.abort());
  // GSI's address search, from the browser: one hit in Nishinomiya.
  await page.route('https://msearch.gsi.go.jp/**', (route) => route.fulfill({
    json: [{ geometry: { coordinates: AT, type: 'Point' }, type: 'Feature', properties: { title: `兵庫県西宮市${TOWN}` } }],
    headers: { 'access-control-allow-origin': '*' },
  }));
  // The geocoder says Nishinomiya and the town; the area is the Worker's own choice.
  await page.route('**/api/place?*', (route) => {
    const city = cityByCode(NISHINOMIYA)!;
    return route.fulfill({ json: { city: city.code, area: areaOf(city, TOWN).key, town: TOWN } });
  });
  await page.route('**/api/catalog?*', (route) => {
    const code = new URL(route.request().url()).searchParams.get('city');
    return route.fulfill({ json: { query: `/entities?type=CatalogItem&q=municipality=="${code}"`, items: catalogue.filter((i) => i.city === code) } });
  });
  await page.route('**/api/requests', (route) => {
    const body = route.request().postDataJSON();
    sent.bookings.push(body);
    const parsed = parseBooking(body);
    const city = cityByCode(NISHINOMIYA)!;
    const area = areaOf(city, TOWN);
    const days = collectionDays(area, todayJst(new Date(Date.now() + city.leadDays * 86_400_000)), WINDOW_DAYS);
    // As createRequest does: a wished day outside the collection days of the window is refused.
    if (parsed.wishedDay && (parsed.wishedDay < days[0]! || parsed.wishedDay > days[days.length - 1]!)) {
      return route.fulfill({ status: 400, json: { error: `the wished day must be from ${days[0]} to ${days[days.length - 1]}` } });
    }
    const lines: Line[] = parsed.items.map((l) => ({ item: catalogue.find((i) => i.id === l.id)!, qty: l.qty }));
    const perDay = dayCosts(area, area.key, days, { at: parsed.location, serviceMin: tally(lines).twoPerson ? SERVICE_TWO_PERSON_MIN : SERVICE_MIN }, new Map());
    const costs: Costs = { ...summarize(perDay, parsed.wishedDay), days: perDay, planner: 'mock' };
    booking = toRequestEntity({ uuid: uuid(1), booking: parsed, city, area, town: TOWN, lines, costs });
    return route.fulfill({ status: 201, json: { id: booking.id } });
  });
  await page.route(/\/api\/requests\/[^/]+\/day$/, (route) => {
    const body = route.request().postDataJSON() as { day: string };
    sent.days.push(body);
    // As chooseDay in src/index.ts: only one of the offered days.
    const offers = (booking!.slotCosts as { value: Costs }).value.offers;
    if (!offers.includes(body.day)) return route.fulfill({ status: 400, json: { error: 'pick one of the offered days' } });
    chosen = body.day;
    return route.fulfill({ json: { id: booking!.id, day: body.day } });
  });
  await page.route(/\/api\/requests\/[^/]+$/, (route) => {
    if (!booking || !outcome) return route.fulfill({ status: 404, json: { error: 'not found' } });
    const id = String(booking.id);
    const intake = written(decision(2, INTAKE_ROUTE, outcome.intake.action, outcome.intake.rule), INTAKE_ROUTE, id);
    const slot = outcome.slot && written(decision(3, SLOT_ROUTE, outcome.slot.action, outcome.slot.rule), SLOT_ROUTE, id);
    const entity: Record<string, unknown> = {
      ...booking,
      intake: intake.attribute,
      ...(slot && { slot: slot.attribute }),
      ...(chosen && { confirmedDay: { type: 'Property', value: chosen }, status: { type: 'Property', value: 'confirmed' } }),
    };
    return route.fulfill({ json: { entity, intakeDecision: intake.entity, slotDecision: slot?.entity ?? null, day: dayOf(entity as Parameters<typeof dayOf>[0]), query: `/entities/${encodeURIComponent(id)}` } });
  });
  return sent;
}

/** Step 1: finds the place with the address search, and goes on. */
async function findPlace(page: Page) {
  // The page draws this step at once and again when /api/config arrives: wait
  // for the second draw (the map line is set with it), so every test starts
  // from the same page. Typing before it is tested on its own (#13).
  await expect(page.locator('#status')).toHaveText('The map could not be loaded.');
  await page.getByRole('searchbox', { name: 'Search for a place' }).fill(`西宮市${TOWN}`);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('#flow-body dl')).toContainText(TOWN);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#flow-title')).toHaveText('What is to be collected?');
}

/** Step 2: adds an item of the city's catalogue, found by the list's filter. */
async function addItem(page: Page, id: string) {
  const item = catalogue.find((i) => i.id === id)!;
  await page.getByRole('searchbox', { name: /./ }).last().fill(item.name.en.slice(0, 20));
  await page.locator('ul.catalog li').filter({ hasText: item.name.en }).first().getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('ul.lines')).toContainText(item.name.en);
}

/** Steps 2 to 4 after the items: on with the day as it is, and send. Returns the day selected in step 3. */
async function sendBooking(page: Page) {
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#flow-title')).toHaveText('Which day?');
  const wishedDay = await page.locator('#day').inputValue();
  expect(wishedDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#flow-title')).toHaveText('Check and send');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('#flow-title')).toHaveText('Your booking');
  return wishedDay;
}

test('the page loads at the first step, without the map', async ({ page }) => {
  await stubServices(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/Pointsman/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bulky waste, collected on a day that fits');
  await expect(page.locator('#flow-title')).toHaveText('Where are the items put out?');
  await expect(page.locator('#status')).toHaveText('The map could not be loaded.');
  await expect(page.getByRole('searchbox', { name: 'Search for a place' })).toBeVisible();
});

test('an address typed before /api/config answers stays in the search box, with the focus and the cursor (#13)', async ({ page }) => {
  await stubServices(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/config', async (route) => { await held; await route.continue(); });
  try {
    await page.goto('/');
    const box = page.getByRole('searchbox', { name: 'Search for a place' });
    await box.fill(`西宮市${TOWN}`);
    await box.evaluate((input: HTMLInputElement) => input.setSelectionRange(3, 3));
    release();
    // The second draw: the map line is set with it.
    await expect(page.locator('#status')).toHaveText('The map could not be loaded.');
    await expect(box).toHaveValue(`西宮市${TOWN}`);
    await expect(box).toBeFocused();
    expect(await box.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([3, 3]);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('#flow-body dl')).toContainText(TOWN);
  } finally {
    release();
  }
});

test('a redraw keeps the typed text and the search status, in the new language, and does not take the focus (#13)', async ({ page }) => {
  await stubServices(page);
  let answer!: () => void;
  const answered = new Promise<void>((resolve) => { answer = resolve; });
  // Nothing found, but only once the test lets GSI answer.
  await page.route('https://msearch.gsi.go.jp/**', async (route) => { await answered; await route.fulfill({ json: [], headers: { 'access-control-allow-origin': '*' } }); });
  try {
    await page.goto('/');
    await expect(page.locator('#status')).toHaveText('The map could not be loaded.');
    await page.getByRole('searchbox', { name: 'Search for a place' }).fill('どこか');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.locator('#search-status')).toHaveText('Searching…');
    // The language switch draws the step anew while GSI has not answered.
    await page.locator('#lang').click();
    const box = page.getByRole('searchbox', { name: '場所を検索' });
    await expect(box).toHaveValue('どこか');
    await expect(box).not.toBeFocused();
    answer();
    await expect(page.locator('#search-status')).toHaveText('西宮市・芦屋市で見つかりませんでした。');
  } finally {
    answer();
  }
});

test('the language switch shows the page in Japanese', async ({ page }) => {
  await stubServices(page);
  await page.goto('/');
  await page.locator('#lang').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('#flow-title')).toHaveText('品目を出す場所はどこですか');
});

test('the developer view opens and closes', async ({ page }) => {
  await stubServices(page);
  await page.goto('/');
  const dev = page.locator('#dev');
  await expect(dev).toBeHidden();
  await page.locator('#dev-toggle').click();
  await expect(dev).toBeVisible();
  await expect(page.locator('#dev-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#dev-toggle').click();
  await expect(dev).toBeHidden();
});

test('a booking that can be planned: the page offers days, and sends the one picked', async ({ page }) => {
  const sent = await stubServices(page, { intake: { action: 'plan', rule: null }, slot: { action: 'offer_days', rule: 5 } });
  await page.goto('/');
  await findPlace(page);
  await addItem(page, IRONING_BOARD);
  const wishedDay = await sendBooking(page);
  // What the page sent: the place, the item, and the day as selected in step 3 ("preferred").
  expect(sent.bookings).toHaveLength(1);
  expect(sent.bookings[0]).toMatchObject({ location: AT, items: [{ id: IRONING_BOARD, qty: 1 }], dateNeed: 'preferred', wishedDay, carryOut: false, lang: 'en' });
  const flow = page.locator('#flow-body');
  await expect(flow.locator('.verdict').first()).toHaveText('Can be planned');
  await expect(flow.locator('.verdict').nth(1)).toHaveText('Pick one of these days');
  // The offered days are the Worker's own route costs for this booking.
  const offers = flow.locator('.actions').filter({ hasNotText: 'Make another booking' }).first().getByRole('button');
  // The last of them, so a page that always sends the first offered day fails.
  await expect(offers.first()).toBeVisible();
  const label = await offers.last().textContent();
  await offers.last().click();
  // The click returns before the stub has recorded the request: wait for it.
  await expect.poll(() => sent.days.length).toBe(1);
  await expect(flow.locator('.chosen')).toHaveText(`Collection on ${label}`);
});

test('items the city does not collect: the page lists them with the city\'s advice', async ({ page }) => {
  await stubServices(page, { intake: { action: 'redirect', rule: 1 } });
  await page.goto('/');
  await findPlace(page);
  await addItem(page, APPLIANCES);
  await sendBooking(page);
  const flow = page.locator('#flow-body');
  await expect(flow.locator('.verdict')).toHaveText('Some items go elsewhere');
  await expect(flow).toContainText('The city does not collect these as bulky waste.');
  await expect(flow).toContainText('Home Appliance Recycling Law items');
  // Back to the items, as they were.
  await flow.getByRole('button', { name: 'Change the booking' }).click();
  await expect(page.locator('#flow-title')).toHaveText('What is to be collected?');
  await expect(page.locator('ul.lines')).toContainText('Home Appliance Recycling Law items');
});

// The tests' safety rests on the --var settings in playwright.config.ts
// winning over a local .dev.vars: then the Worker's broker and geocoder are a
// closed port. A network failure gives "something went wrong"; a real service
// that answered (even with an error) would give the data platform's or the
// address service's own message, or a result.
test('the Worker cannot reach a real broker: an unstubbed call fails at once', async ({ request }) => {
  const res = await request.get('/api/catalog?city=28204');
  expect(res.status()).toBe(502);
  expect(await res.json()).toEqual({ error: 'something went wrong' });
});

test('the Worker cannot reach GSI\'s geocoder: an unstubbed call fails at once', async ({ request }) => {
  const res = await request.get('/api/place?lon=135.37311&lat=34.74305');
  expect(res.status()).toBe(502);
  expect(await res.json()).toEqual({ error: 'something went wrong' });
});
