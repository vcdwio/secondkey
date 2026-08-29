# Pitfalls

## Product boundaries
- Do not turn the Unit catalog into an agent marketplace.
- Do not count shared-core services as customer-facing Units.
- Do not use vector search for exact amounts, dates, owners, status, or identifiers.
- Do not let archived policies override active policies.
- Do not let a Unit write externally without the shared approval gate.
- Do not present model self-reported confidence as calibrated confidence.
- Do not mix records across the seven fictional client accounts.
- Do not treat the 12 proposed staff-hours as an executed allocation; the data pack keeps the packet awaiting approval.
- Do not replay `scenario.resource_changes` in production code. Capacity proposals must come from `allocateCapacity()`; fixtures may only assert the expected result.
- Do not use `GEMINI_API_KEY` as Vertex Agent Engine state authentication. Google ADK 2.0 requires Application Default Credentials for its Vertex session and memory implementations.
- Do not claim Cloud Agent Registry publication: the ADK 2.0 TypeScript client in this build supports discovery/query, while the synchronized local registry is the implemented catalog.
- Do not expose raw backend errors through HTTP; credential-bearing providers must fail behind stable, sanitized responses.
- Do not export user-controlled CSV cells beginning with `=`, `+`, `-`, or `@` without neutralizing spreadsheet formulas.

## Demo credibility — learned the hard way
- A number typed into JSX is a number a prospect will ask about. Everything visible now comes from `npm run data`; if it cannot be derived from the pack, it does not belong on screen.
- Selection state that only changes a highlight is the fastest way to lose a room. Every click must change what is displayed.
- Role switching that only truncates a list is not a permission model. Enforce it at the action, not at the view.
- "Approved" that changes a colour and nothing else invites the question the demo cannot answer. Show the calls, the keys, and the rollback.
- Claims about safety need a button. Static text saying injection was blocked convinces nobody; firing EM-023 live does.
- Do not ship a governance story without an audit export. It is the first thing a compliance reviewer asks for.

## Build and tooling
- The supplied pack validator must run from `fixtures/verge-demo-pack`, not from the repository root.
- `node_modules` here is platform-bound (rolldown ships a native binding). Moving the folder between macOS and Linux breaks `npm run build`; reinstall after switching platform.
- `rendered-html.test.mjs` matches literal strings in server HTML. React inserts `<!-- -->` between an interpolation and adjacent text, so write `{`${n} regression scenarios`}` rather than `{n} regression scenarios` wherever a test matches that text.
- Relative TypeScript imports in `lib/` need the `.ts` extension for `node --test` to strip types; `allowImportingTsExtensions` is enabled in tsconfig to keep `tsc --noEmit` agreeing with it.
- The ADK package used here requires Node 24.13 or newer. The Cloud Run Docker image pins Node 24.18 so source and container builds use a compatible runtime.
- A Dockerfile is not container proof. The initial verification environment could not deploy it; the final evidence now comes from Cloud Build, Cloud Run revision `secondkey-agent-00004-7vb`, `/status`, real `/triage`, and Cloud Trace. `/healthz` remains a known front-door 404 and must not be used as the hosted health proof.
- The legacy `@google-cloud/opentelemetry-cloud-trace-exporter` can be flushed successfully through the global provider delegate, but it now logs that it will be archived after 2026-10-30. Migrate to Google's supported OpenTelemetry OTLP endpoint before that date; do not wait for a submission-day exporter failure.
- ADK `FunctionCallingConfigMode.ANY` guarantees another tool call, not a clean one-tool-then-stop handoff. Instruction text asking a tier to call once and then reply with text conflicts with that structural setting; in real Gemini runs the draft tier repeated calls and later tiers could emit no tool call. Treat all-three delegation as unverified until the orchestration/termination design changes, and cap `runConfig.maxLlmCalls` meanwhile.
- ADK model failures, including the max-LLM-call guard, arrive as error events instead of rejected promises. A runtime that only harvests function calls can silently return a partial success. Inspect `errorCode`/`errorMessage` and fail closed before constructing delegation evidence.
- Cloud Trace v1 can return an empty unfiltered recent list even when a known trace is retrievable. Verify application spans with an explicit prefix filter such as `span:contextops.audit.` and retain the redacted result; do not equate an empty unfiltered response with failed export.
- Scrollable containers need `tabIndex={0}` for axe (`scrollable-region-focusable`); pair it with `role="region"` and a label so `jsx-a11y/no-noninteractive-tabindex` stays satisfied.
- `worker/index.ts` referenced two Cloudflare globals (`Fetcher`, `D1Database`) that no installed package declares, so `tsc --noEmit` failed on them. Fixed with local declarations in `worker/cloudflare.d.ts`; swap in `@cloudflare/workers-types` if the worker ever needs the full runtime surface.
- The Cowork device mount refuses to overwrite an existing file, so `tar xzf` into the project reports `Cannot open: File exists` and silently lands only the *new* files — leaving a half-old, half-new tree that looks like the change never happened. Extract to a temp directory and write each file through with `cat src > dest` (truncate is permitted, unlink is not).
- Git works through the Cowork device mount but leaves litter: the mount forbids `unlink`, so every operation abandons a `.git/*.lock` file and stray `.git/objects/**/tmp_obj_*` blobs, and the *next* git command then fails with "Unable to create index.lock: File exists". `rename` is permitted, so `mv .git/index.lock .git/index.lock.stale` unblocks it. Run git from a normal macOS terminal instead; use the mount only when there is no alternative, and never run `git gc` there.
