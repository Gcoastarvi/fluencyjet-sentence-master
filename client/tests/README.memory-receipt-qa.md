# Memory Meta receipt QA preparation — MOCK ONLY

This is a separate, off-by-default scaffold. It cannot send real Meta events.
There is no live flag, real credential reader, owner-facing send endpoint,
general HTTP proxy or production backend startup. Importing its launcher does
not start anything. The hardened `runMemoryQa.mjs` and its source suite are
unchanged.

## Authorized offline commands

From the independent Pixel worktree, with independent offline dependency copies
at root, client and server (no source links, installs or lifecycle scripts):

```sh
env -i PATH="$PATH" HOME=/tmp/memory-receipt-parent NODE_ENV=test \
  node --test client/tests/memoryReceiptPolicy.test.mjs \
  client/tests/runMemoryQa.test.mjs client/tests/memoryNavigationDiagnostics.test.mjs

env -i PATH="$PATH" HOME=/tmp/memory-receipt-parent \
  python3 -B client/tests/memoryQaNetwork.test.py

env -i PATH="$PATH" HOME=/tmp/memory-receipt-parent NODE_ENV=test \
  node client/tests/runMemoryReceiptQa.mjs --mock --acknowledge-synthetic-consent
```

No flags or `--real` refuse before creating a namespace/server. Acknowledgement
is for synthetic fixture consent only, NOT permission to use real matching data.
Mock context accepts only public, obviously invalid placeholder credentials and
the `OFFLINE_MEMORY_TEST` code; supplying a real token is unsupported. No shared
workspace environment/secret values or `.env` files are read/copied.

## Process-level isolation and actual application coverage

The separate launcher reuses existing isolation validators and test Vite config.
It requires a distinct network namespace, genuine loopback and only optional
inert SIT `sit0`, complete IPv4/IPv6 inventories in all tables, unchanged
post-setup inventory, all capabilities dropped and no-new-privileges. These
conditions are rechecked before Vite and each test process. Actual receipt test
processes additionally check the private 0600, owned manifest and kernel state.
Failures have no host-network fallback.

Child environments are explicit, without inherited credentials, loader options
or production settings. Vite binds loopback with empty scratch envDir/cache,
no API proxy and no normal config. Generated suites, browser profiles, manifests
and Jest caches are scratch-only. Supertest starts only its ephemeral route
fixture, not the normal backend. Launcher cleans its scratch and QA processes;
the operator cleans independently copied dependencies.

Browser assembly reads the original test fixture and performs exact, checked
test-only substitutions IN SCRATCH. Shape drift refuses before browser launch.
Every original test/assertion remains. Additional receipt cases reuse actual
result/school/advanced React code and mocked lead/order data. For these cases,
the application creates its real SDK bootstrap queue; a clearly fake SDK
adapter drains it, records the application calls, and generates candidate
tracker requests that CDP fulfills locally. This is NOT execution of Meta SDK.
Razorpay is a JavaScript mock, every API/third-party request is intercepted,
and the kernel independently prevents all external traffic.

Server fixtures import the actual signed webhook router and actual CAPI helper,
with Prisma mocked BEFORE router imports. The helper's `fetch` is replaced by a
validating mock, never real HTTP. Tests are `.receipt.mjs`, intentionally outside
normal server Jest testMatch, and refuse outside the sealed namespace. There is
no database connection, provider API, WhatsApp consent or message creation.

The helper currently does not set fetch redirect policy. The QA transport
descriptor enforces `redirect:error` without changing its URL/payload or FJ.
Any eventual real broker must enforce this independently. Memory remains v26;
legacy FJ v19 is unchanged and needs its own separately reviewed migration.

## Validation recorded 2026-10-11

- Policy/safety/diagnostics: **76/76**, including existing 47 safety/diagnostic
  checks and 29 new policy/scaffold checks.
- Network parser: **9/9**.
- Combined isolated browser suite: **40/40** (31 existing + 9 receipt cases).
- Isolated signed Purchase fixtures: **10/10**.
- Initial browser attempt: **39/40**. The new school-result receipt test sent
  Escape immediately after Lead recording, before the VSL dialog was ready.
  It now waits for the real open iframe and focused Close control, then uses
  native Escape. No UI force-enable, artificial dialog or weakened assertion.
  All 40 cases passed on the corrected run; server tests ran only after it passed.

Assertions cover saved-only Lead for all three tracks, once-only across reload,
successful open BEFORE standard InitiateCheckout on result/school/advanced,
open-throws suppression and rejected lead save. Existing ordering, order-failure,
visibility, document ownership/Back/Forward and no-browser-Purchase tests remain.
Candidate tracker policy rejects FJ/root/foreign paths, identity-bearing URLs,
private score/contact parameters, ambiguous IDs and browser Purchase.

Signed captures produce actual helper Purchase payloads for assessment and
standalone tracks, fixed 99 INR, v26 BrainoDad-only destination, current seconds
timestamp, hashed synthetic email, synthetic UA and no invented IP/click cookies.
Replay yields exactly one mocked HTTP call and purchase insert. Invalid
signature, wrong amount, missing token, missing QA code and foreign dataset
fail before simulated receipt. Public fixture data is never customer data.

## BLOCKED: real receipt needs separate explicit approval and infrastructure

Changing a flag, adding a token or opening normal Preview cannot enable live
receipt here. There is deliberately NO real transport. Do NOT relax the offline
namespace, enable general internet, use main WhatsApp worktree/workflows, or copy
browser auth cookies/profiles to work around this.

Before authorizing a later real run, owner must approve:

1. **A separate authenticated exact-egress broker and controlled browser
   session.** Keep Vite/Chromium/fixtures loopback-only. A private, owner-
   authorized broker outside that namespace must have sanitized environment,
   authenticated local IPC, a time-limited single-purpose approval and no
   arbitrary CONNECT/URL forwarding. It must verify exact HTTPS host/path,
   pixel/dataset, payload and approved source URL; refuse redirects and unknown
   requests. Browser SDK configuration/plugins may need additional individually
   reviewed endpoints. Current pure candidate policy is NOT an egress firewall
   and NOT evidence those real SDK requirements work. If this boundary cannot
   be enforced, STOP; no broad-network fallback.
2. **Private, isolated server-only QA storage.** Dedicated BrainoDad token plus
   its separate Meta Test Events code; never FJ credentials, shared app/Railway
   secrets or frontend tokens. Mandatory QA code must be validated BEFORE
   forwarding any Graph request. Require only
   `https://graph.facebook.com/v26.0/1998316064175555/events`.
3. **Matching consent.** Owner-controlled consenting tester email and genuine
   browser UA/context supplied privately; hash email through the actual helper.
   No students/customers, copied cookies, fake click attribution or invented
   client IP. Current synthetic matching constants must NOT be sent live.
4. **Browser test-session association.** In BrainoDad Test Events, use Test
   browser events/Open Website for the exact approved QA Memory URL. Establish
   consent and `fj_meta_qa_opt_in` in that actual tab before reload. A newly
   opened tab may not inherit opt-in. The browser code does NOT use
   `MEMORY_META_TEST_EVENT_CODE`; that is server-only. Prior Preview PageView
   receipt does not establish association for a new headless profile. Resolve
   interactive session association without copying authentication secrets.
   Do not assume Preview events are test-only without observed association.
5. **A bounded approved run.** Exact Memory result and school/advanced paths,
   synthetic lead/order replies, mocked checkout, no provider SDK/payment,
   DB or messaging. Start with PageView association, then one saved Lead and
   one valid-open InitiateCheckout per relevant path; verify standard labels,
   destination, source URL and no FJ contamination. Do not test FJ with real
   SDK in this Memory-only receipt context. Keep full FJ navigation regression
   coverage offline.
6. **Signed Purchase verification.** Process fresh, uniquely identified
   simulated captures through the actual router/helper and in-memory Prisma.
   Validate standard Purchase 99 INR and test code BEFORE egress; inspect
   actual receipt in BrainoDad Test Events, then replay the same capture and
   verify no second send. Unique IDs are needed across separate approved runs.
   Preserve token redaction and avoid logging identity/headers/raw payloads.
7. **Cleanup and release separation.** Remove only QA-owned temporary resources
   and disable/revoke that run's broker authorization. Remove QA test-event
   code from any separately approved LIVE configuration. No push, merge,
   deployment, campaign change or production secret change is authorized by
   receipt QA approval.

Current evidence is all mocked. Actual Meta SDK behavior, Test Events
association, endpoint/plugin needs, standard Lead/InitiateCheckout/Purchase
receipt and real matching remain UNVERIFIED. Existing PageView and standalone
Owner_QA custom server receipt are useful but do not close those gates.
