/**
 * Minimal local declarations for the two Cloudflare runtime globals this worker
 * references. The project does not depend on `@cloudflare/workers-types`, and
 * without these `tsc --noEmit` reports `Cannot find name 'Fetcher'` and
 * `Cannot find name 'D1Database'`. Replace this file with the official types
 * package if the worker ever needs the full runtime surface.
 */

/** Service binding used to fetch static assets from the Worker. */
interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

/** D1 binding. Declared but unused in the demo — no query runs in this build. */
interface D1Database {
  prepare(query: string): unknown;
  batch(statements: unknown[]): Promise<unknown>;
  exec(query: string): Promise<unknown>;
}
