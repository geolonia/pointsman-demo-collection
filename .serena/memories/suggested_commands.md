# Commands

Full list: README "Development" and "Setup". Order: `pnpm engine`, `pnpm install`, `pnpm check`.
- `pnpm check` = typecheck + tests + dry-run deploy; it is what CI runs (CI also runs `pnpm engine` first).
- `pnpm engine` skips the check when `engine/` is a link to a local clone; it does not warn that the engine differs from the pin. Run `ls -la engine` to see which one is in place; before trusting `pnpm check` for CI, restore the pinned copy (`rm engine && pnpm engine`).
- `pnpm dev` needs `.dev.vars` (git-ignored); for no real broker use `node scripts/mock-broker.mjs` (README has the values).
- `node scripts/load-catalog.mjs` is a dry run; it writes only with `--apply` (and `BROKER_API_KEY`).
- Profile cases are run from the deployment config's engine checkout, not from here: this repo's `engine/` has no dependencies or fact modules installed (README "Development").
