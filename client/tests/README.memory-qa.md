# Offline Memory conversion QA

On the development branch, with existing dependencies installed:

```sh
node --test client/tests/runMemoryQa.test.mjs client/tests/memoryNavigationDiagnostics.test.mjs
python3 -B client/tests/memoryQaNetwork.test.py
node client/tests/runMemoryQa.mjs
```

The runner never starts the backend or a Replit workflow. It passes an explicit
non-secret child environment, ignores normal Vite config/environment files,
binds Vite to `127.0.0.1:3000`, disables its API proxy, and keeps environment,
cache, home and browser-profile output in temporary scratch.

Linux `unshare`, `setpriv`, user/network namespace permission and `python3` are
required. Complete kernel netlink dumps must prove a different namespace with
genuine loopback and, optionally, only default Linux SIT `sit0` (type 776,
flags 128: DOWN), with no tunnel addresses or routes. Every other interface,
non-loopback address/route (IPv4/IPv6, all tables), unknown route attributes,
malformed/truncated/interrupted dump, or incomplete inspection is rejected.
Inventory uses namespace-local netlink, never host-mounted `/sys/class/net`.

Python configures only loopback inside that namespace, then inventories it again.
`setpriv` removes all capability sets, including bounding/ambient capabilities,
and enables no-new-privileges. These restrictions and the exact post-setup
inventory are verified before Vite imports and again before Chromium launch.
An inability to inspect, configure or drop privileges fails closed. There is no
host-network/non-isolated fallback; no normal workflow/backend should be used.
The namespace isolates Vite, Chromium and descendants from external networking.
A failure exits nonzero and cleans QA scratch and QA-owned child processes.

For concurrent development use a separate worktree. Do not check out/copy `.env`
files, install dependencies, or run normal Vite config. Use independent offline
dependency copies with no symlinks back to source or writable caches in the main
worktree. Run the launcher itself with an explicit sanitized environment, e.g.
`env -i PATH="$PATH" HOME=/tmp/qa-home NODE_ENV=test node client/tests/runMemoryQa.mjs`.
The child allowlist also excludes `NODE_OPTIONS`, loader/preload variables,
credentials and production settings. `HOME` inside QA is fresh temporary scratch.

The browser suite still intercepts API/external page requests before navigation
and stubs Meta/Razorpay. It checks exact successful-open/InitiateCheckout ordering
on result and standalone school/advanced pages, and no dispatch when order
creation fails or open throws. This is mock behavior verification, not proof of
real Meta receipt.

## Navigation diagnostics and readiness

The browser harness maintains a Node-side CDP ledger of committed top-frame
paths, frame/loader/context identities and per-document SDK initialization.
Expected ownership is immutable for the committed loader; same-document history
or BFCache restoration cannot relabel it. Only pathnames are retained, never URL
query/hash values or SDK identity/payload fields. Browser bindings separately
record fixture document IDs, time origins and real/synthetic lifecycle chronology.
Untrusted synthetic `pageshow(persisted:true)` covers the handler, not actual
BFCache behavior. Trusted `pageshow` and CDP commits provide independent evidence.

History waits require complete documents, the correct single initialization,
the real application boundary owning the route, trusted browser `pageshow`,
two painted frames and a consistent committed-loader snapshot. Foreign-history
recovery must yield a fresh document AND loader. Reload waits reject old DOM
matches by requiring a changed fixture document ID before checking the offer.
HMR is disabled only in the dedicated test Vite config. This installed Vite
version still starts its client socket with `hmr:false`, so a fail-closed test
plugin removes ONLY the recognized dev-client socket bootstrap, leaving CSS
helpers intact. Production bundles contain no Vite dev client. An unrecognized
bootstrap fails instead of making a guessed transform. Dev-client WebSocket
reconnect reloads must not race real browser Back/Forward restoration. Navigation
initiators and reconnect notices are recorded. Invalid interception IDs are
benign only when the corresponding network request was independently reported
cancelled by Chromium; other transport errors still fail.

The independent committed-owner checks supplement, rather than remove, the
original early-path checks. Exactly one correct SDK initialization per committed
document, no wrong-pixel dispatch and no foreign DOM exposure remain mandatory.
Any failure includes its offending document and sanitized navigation chronology.
The history test prints its sanitized successful trace for review. Missing
association evidence or conflicting loader identity fails rather than guessing.

### Offline validation status (2026-10-11; not live Meta receipt)

- Latest checks: 47/47 Node safety/diagnostic tests and 9/9 Python netlink parser
  tests passed. TWO CONSECUTIVE full browser runs passed 31/31 each, with no
  failures or skipped cases. Each full run independently passed the hardened
  namespace, post-loopback inventory, capability-drop and no-new-privileges gates.
- Both history cases passed the original and committed-loader
  assertions. CDP/trusted lifecycle evidence showed two real Memory BFCache
  restores, one real FJ restore, and a fresh Memory result document following
  the deliberately foreign synthetic popstate. Every committed document
  initialized exactly its expected single pixel.
- Earlier instrumented history failures were raced by a proven `/@vite/client`
  script-initiated reload immediately after real BFCache restoration, with a
  matching Vite reconnect notice. Removing only the QA dev socket bootstrap
  eliminated that observed interference. The original historical early-path
  versus SDK mismatch was not reproduced; its exact root cause remains unconfirmed.
- The previous standalone registration/offer-navigation failure timed out after
  an early click. The fixture's router-probe branch bypassed standalone event
  readiness, while the actual UI disabled checkout until valid event data loaded.
  Standalone fixtures now require a complete, committed Memory-owned document,
  the loaded schedule and a genuinely enabled CTA even with the probe active.
  The registration case rechecks route/document/ownership and observes a native
  enabled-button click before waiting for the real dialog. No button is force
  enabled, dialog injected, assertion relaxed or case skipped. This case passed
  both full runs; an underlying application defect was not demonstrated.
- Saved-only, once-only Lead; successful checkout.open BEFORE standard
  InitiateCheckout on result/school/advanced; failed order/open suppression;
  actual offer visibility; same-funnel SPA behavior; and no browser Purchase
  assertions all passed. Backend/CAPI and live SDK receipt were not exercised.

Real receipt QA is separate: owner-approved isolated fixtures, no production DB,
payment keys or messaging services; real BrainoDad-only SDK Lead/InitiateCheckout
and synthetic signed Purchase through a mocked database with a dedicated server
token and Memory test-event code. Never expose that token to frontend code.
