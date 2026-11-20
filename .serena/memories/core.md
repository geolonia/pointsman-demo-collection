# pointsman-demo-collection (Pointsman demo: bulky waste collection bookings, Nishinomiya and Ashiya; collection.demo.pointsman.net)

Canonical docs (do not duplicate): README.md (how it works, decision tables, mock planner, API, setup, development), AGENTS.md (org policy, constraints, issue intake), CONTRIBUTING.md (PR rules, DCO). The README is the only documentation (no TechDocs).

Source map:
- `src/index.ts` = Worker entry (API, `/notify`, hourly cron cleanup, queue consumer); `requests.ts` = booking entities and the input names sent to the profiles; `plan.ts` = mock route planner (`slotCosts`), to be replaced by VROOM/OSRM; `broker.ts`, `catalog.ts`, `cities.ts`, `geocode.ts`, `http.ts`, `env.ts` = helpers.
- `site/` = the page (plain HTML/CSS/JS, no build step); `site/_headers` = CSP, checked by `pnpm test`.
- `profiles/` = draft decision profiles (rules only); `cases/` = their test cases.
- `data/` = city catalogues, rules and facilities (cited from the cities' pages); `scripts/` = engine fetch, catalogue load, subscription setup, local mock broker.
- `wrangler.jsonc` = Worker config (vars, queues, cron, rate limits); no resource ids or secrets in it.

Cross-repo:
- `engine.json` pins a `geolonia/pointsman` commit; `src/` imports the FIWARE bridge from `engine/packages/fiware`, so typecheck and tests need `engine/`.
- No engine doc describes this demo (`docs/fiware-demo.md` is the roads storyboard); the bridge is in the engine's `packages/fiware`.
- `profiles/` are drafts: the published copies live in the private deployment config and must stay in step, with the same `cases/`.
- Sibling demos: pointsman-demo-roads, pointsman-demo-buildings.

Further: `mem:tech_stack`, `mem:suggested_commands`, `mem:conventions`, `mem:task_completion`.
