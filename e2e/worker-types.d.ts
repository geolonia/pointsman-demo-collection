// The Workers runtime types that src/env.ts names (src/requests.ts reaches it
// through type-only imports). The tests use no bindings, so opaque is enough.
type Fetcher = unknown;
type RateLimit = unknown;
type Queue<_Body = unknown> = unknown;
