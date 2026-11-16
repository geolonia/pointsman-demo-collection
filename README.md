# Pointsman collection demo

A demo of [Pointsman](https://github.com/geolonia/pointsman) on a smart-city
data platform (FIWARE), for collection requests: here, bulky waste
(粗大ごみ) in Nishinomiya and Ashiya. A resident books a collection step by
step. Pointsman checks the booking and picks a collection day that fits the
truck's route, with a reason for each decision.

The same core works for other requests that end in a visit: a pickup, a
repair, an inspection. Only the catalogue, the rules and the profiles change.

Address (once deployed): https://collection.demo.pointsman.net (all demos:
https://pointsman.net/demos/). The other demos:
[roads](https://github.com/geolonia/pointsman-demo-roads) and
[buildings](https://github.com/geolonia/pointsman-demo-buildings).

Nothing goes to the cities, no truck comes, and every booking is deleted
after a day. Book with your city for a real collection.

## Status

The first step: the booking page, with route costs from a simple model.

- Both cities' item lists with fees (Nishinomiya 222 items, Ashiya 224), and
  what each city does not collect as bulky waste, with where to take it
  instead. They are `CatalogItem` entities in GeonicDB, an NGSI-LD context
  broker ([data/](data/), [scripts/load-catalog.mjs](scripts/load-catalog.mjs)).
- The booking page: place, items, day, check and send, result. The booking is
  a `ServiceRequest` entity; Pointsman's results are written back to it, with
  a `Decision` entity for each.
- Two rules-only profiles ([profiles/](profiles/), no AI model):
  `bulky-waste-intake` (can the booking be planned?) and `bulky-waste-slot`
  (which day?).

Next steps:

1. Real routes: [VROOM](https://github.com/VROOM-Project/vroom) for the cost
   of one more stop each day, with [OSRM](https://project-osrm.org/) road
   distances, in place of the mock planner ([src/plan.ts](src/plan.ts)). The
   profiles stay as they are: they read the same numbers.
2. The crew page: the day's stops in order, a photo of the items when
   collected.
3. The operations page: the day's plans, the bookings that wait for a person.
4. A booking in the resident's own words, read by AI (an intake question),
   and a LINE bridge for confirmations and reminders.

## How it works

1. **Place.** The resident clicks the map, or searches a place (GSI's address
   search, from the browser). GSI's reverse geocoder gives the city and the
   town (`/api/place`). The demo needs no address, name or phone number.
2. **Items.** The city's catalogue, read from the broker
   (`/api/catalog?city=28204`). Each item has the city's fee; items the city
   does not collect are shown as such.
3. **Day.** How much the resident needs a certain day (it must be that day,
   a preference, or any day), and the wished day. Ashiya carries bulky waste
   out of the home for people who cannot (さわやか収集); Nishinomiya does not,
   so the page asks only in Ashiya.
4. **Send.** The Worker looks up each item, works out what one more stop
   costs each collection day of the next two weeks (`slotCosts`), and creates
   the `ServiceRequest` entity.
5. **Result.** A broker subscription sends the booking to the
   [FIWARE bridge](https://github.com/geolonia/pointsman/tree/main/packages/fiware)
   (from the engine commit pinned in `engine.json`), which asks Pointsman,
   profile `bulky-waste-intake`, and writes the result as `intake`. A second
   subscription sends bookings with an intake result to the slot route
   (profile `bulky-waste-slot`, which builds on the intake), written as
   `slot`. When Pointsman offers days, the resident picks one
   (`POST /api/requests/{id}/day`), stored as `confirmedDay`.

| Intake (`bulky-waste-intake`) | When |
|---|---|
| `redirect` | an item the city does not collect as bulky waste (the page says where to take it) |
| `ask` | no items, or more kinds of item than one booking may have (Nishinomiya: 5) |
| `review` | carrying out of the home: a person arranges it (a `Task` entity) |
| `plan` | otherwise |

| Day (`bulky-waste-slot`) | When |
|---|---|
| `hold` | the intake did not give `plan` |
| `assign_best` | any day is fine, and the cheapest day adds at most 20 minutes |
| `accept` | the wished day adds at most 15 minutes, or the resident must have that day and the truck can still take it |
| `offer_days` | otherwise, the three cheapest days |
| `review` | no day in two weeks can take it (a `Task` entity) |

The profiles here are drafts; the published copies live in the private
deployment config, with the same test cases ([cases/](cases/)).

### The mock planner

[src/plan.ts](src/plan.ts) stands in for VROOM and OSRM. Each day has one
truck with a crew of two, starting and ending at the facility the bulky
waste goes to ([data/facilities.json](data/facilities.json)): Nishinomiya's
東部総合処理センター at Naruohama for the whole city (since April 2026 the
west centre no longer takes bulky waste), and Ashiya's 環境処理センター at
Hamakaze-cho. Its stops are made up (seeded, so a day always has the same
ones) around a few neighbourhood centres, plus the demo's own bookings that
have a day. North Nishinomiya (山口町, 塩瀬町) is its own area: a day without
other stops there costs the truck the drive over the mountains. Distances
are straight lines times 1.4, at 20 km/h; a stop takes 5 minutes, 8 for an
item two people carry; a day has at most 30 stops and 6 hours.

The real cities are different: Nishinomiya's current wait is about two to
three weeks, and both cities take bookings by phone (Nishinomiya also on
LINE). The demo starts three days ahead so the result is quick to see.

## Data

From the cities' official pages, retrieved 2026-11-16; every item and rule
cites its page ([data/nishinomiya](data/nishinomiya/rules.json),
[data/ashiya](data/ashiya/rules.json)). English names and categories, and
which items two people carry, are our own. Where the city's sources disagree
(for example the time to put items out: 8:00 on Nishinomiya's web page, 8:30
in its 2026 booklet), `rules.json` says so; the demo uses the earlier time.

## API for the page

| Endpoint | |
|---|---|
| `GET /api/config` | Whether bookings are taken (`bookings`), today in Japan, and per city: limits, put-out time, carry-out service, and per area the facility and the collection days |
| `GET /api/place?lon=&lat=` | The city, area and town of a point (GSI's reverse geocoder); 404 outside the two cities |
| `GET /api/catalog?city=` | The city's `CatalogItem` entities (well-formed ones only) and the NGSI-LD query. Cached 10 minutes when complete |
| `POST /api/requests` | `{"location": [lon, lat], "items": [{"id", "qty"}], "dateNeed": "fixed" \| "preferred" \| "any", "wishedDay", "carryOut", "lang"}`. From the page itself (same origin), 5 a minute per visitor and `DAILY_LIMIT` (300) a day for the whole demo, closed (503) until the bridge is configured. Answers `{"id"}` |
| `GET /api/requests/{id}` | The booking, its `Decision` entities (`intakeDecision`, `slotDecision`) and its day |
| `POST /api/requests/{id}/day` | `{"day"}`: one of the offered days, once, only after `offer_days` |
| `POST /notify` | The broker's subscriptions (secret in `x-bridge-secret`); `?route=slot` is the slot route |

Every hour, bookings older than a day are deleted with their Decision and
Task entities, and a booking without a result after two minutes is sent to
the bridge again (at most 20 a run, during its first two hours).

## Setup

Settings are in [wrangler.jsonc](wrangler.jsonc): `BROKER_URL`,
`BROKER_TENANT` (`pointsman_collection`), `POINTSMAN_URL` and `DAILY_LIMIT`.
Both profiles must be published on `POINTSMAN_URL`. Secrets
(`wrangler secret put <NAME>`):

| Secret | |
|---|---|
| `BROKER_API_KEY` | An API key of the tenant |
| `NOTIFY_SECRET` | Random; the subscriptions send it (`scripts/setup.mjs`) |
| `POINTSMAN_TOKEN` | A Pointsman token limited to `bulky-waste-intake` and `bulky-waste-slot` |

`BROKER_API_KEY` is always needed: without it the page has its map but no
items (502). Without `POINTSMAN_TOKEN` or `NOTIFY_SECRET` (or the queue), the
page shows the cities and their items, and bookings are refused (503).

Once, before the first deploy:

- The queues: `pnpm exec wrangler queues create pointsman-demo-collection-bridge`
  and `pnpm exec wrangler queues create pointsman-demo-collection-bridge-dlq`.
- The subscriptions: `BROKER_API_KEY=… NOTIFY_SECRET=… node scripts/setup.mjs`
  (again after the inputs change). They notify `WORKER_URL`, by default the
  public demo: for your own deployment, set it to your Worker's address.
- The catalogue: `node scripts/load-catalog.mjs` shows what it would write,
  `BROKER_API_KEY=… node scripts/load-catalog.mjs --apply` writes it (again
  after the data changes; upsert never deletes).

## Development

Node 24 and pnpm.

```sh
pnpm engine        # the bridge, from the Pointsman commit in engine.json
pnpm install
pnpm check         # typecheck, tests, dry-run deploy
```

Without a broker tenant, run the local stand-in (it has the catalogue and
answers with both profiles' rules, without Pointsman) and the Worker:

```sh
node scripts/mock-broker.mjs
printf 'BROKER_URL=http://localhost:8790\nBROKER_API_KEY=local\nPOINTSMAN_TOKEN=local\nNOTIFY_SECRET=local\n' > .dev.vars
pnpm dev
```

The profiles' test cases need an engine with the field facts (0.22.0 or
later) and its fact modules: from the deployment config,
`node engine/scripts/test-profile.mjs cases --profiles profiles`.

No build step for the page: plain HTML, CSS and JavaScript in `site/`,
MapLibre GL JS from unpkg with integrity hashes, GSI's map tiles. The page is
served with a Content-Security-Policy ([site/_headers](site/_headers));
`pnpm test` checks the page against it.

Like the other Pointsman demos, this repository has no TechDocs: the README
is its documentation.

## Licence

Code: MIT ([LICENSE](LICENSE)). Item lists and rules: the cities of
Nishinomiya and Ashiya, see [data/](data/).
