# Conventions

Authoritative: AGENTS.md "Constraints" and "Issue intake", CONTRIBUTING.md. Key ones agents trip on:
- Public repo: no secrets, account ids, resource ids, or anything from the private deployment config. Secrets only via `wrangler secret put`.
- DCO sign-off on every commit (`git commit -s`); small PRs with tests.
- Language of issues and PRs: AGENTS.md "Issue intake" and the org agent policy (geolonia/.github `docs/agent-policy.md`); English by default here, as the repo is public.
- Changing a profile or a test case here → the published copy in the private deployment config needs the same change (separate PR there).
- Never point `engine.json` at an unmerged engine commit; bump it to a release commit after the engine PR is merged.
- City data in `data/`: every item and rule cites its official page; keep citations when editing.
