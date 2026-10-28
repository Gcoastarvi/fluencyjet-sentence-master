# BrainoDad tracking review — 28 October 2026

## Verified production baselines (Railway metadata, read-only)

| Service | Source branch | Deployed commit | Deployment |
|---|---|---|---|
| Frontend | feature/brainodad-sticky-scroll-tiles-oct19 | 6e15446706bff98ce494140ee07d951ff72cc0f5 | d372278a-80e3-46f1-9d3d-163c0eb98807 SUCCESS |
| Backend | release/brainodad-parents-oct25 | 5b825a6f1bbf7ecce2592d45fe0f0d282f9f78da | c804a2bf-a0b1-42ac-88cf-8fa78fc16998 SUCCESS |

Work uses separately fetched exact source snapshots, not main. The webhook,
delivery, consent, CAPI serializer and destination files have identical Git blob
SHAs in these two baselines. Frontend and backend patches must remain separate;
deploying the old frontend snapshot as the backend would lose security fixes.
No production variables, credentials, customer records or database were read.

## Existing behavior and real gaps

Already present in source: route-aware PageView, single-dataset dispatch,
fresh-document cross-funnel boundary, consent validation and withdrawal,
memory_track_selected, memory_offer_click, offer visibility on VSL/result
surfaces, InitiateCheckout after Razorpay open, signed captured-payment
verification, unique purchase identifiers, stable payment-derived CAPI identity,
lease-protected delivery, bounded retries, delivery outcome fields and no skipped
purchase backfill. These are source findings and mock results, not a live Events
Manager audit. Reported October SKIPPED_CONSENT records were not queried.

Gaps repaired:

1. Parents page did not use the existing offer-visibility observer.
2. A remembered adult receipt could enable student assessment Meta events.
   Hashed assessment tokens were also used as Lead identities. Hashing does not
   make a student identifier appropriate to share.
3. Completion was emitted after a scoring-only fallback, not only a saved session.
4. Custom-event key filtering still allowed arbitrary nested fields/values.
5. Browser views could repeat on reload; rapid duplicate CTA callbacks were not
   centrally suppressed. Memory now uses a 30-minute, per-tab view window and a
   1.5-second identical-click cooldown. Intentional later clicks still count.
6. Memory CAPI could reuse a visitor ID, cookies or user agent from a child's
   browser. The backend patch removes those fields, retaining adult contact
   matching. This can reduce matching quality; it does not increase eligibility.

The existing event is **memory_track_selected**. `memory_track` is a browser
selection-storage key. No second tracking event is introduced.

## Funnel matrix

All allowed browser events still require a current server-verified adult opt-in.
No permission, expired/revoked permission or consent-service failure means no
Memory SDK initialization/events. A parent's saved choice does not authorize
assessment telemetry. Known student/unknown assessment contexts are withheld.

| Page / action | Event | Result / coverage |
|---|---|---|
| /memory-masterclass/parents | PageView | Allowed with verified adult receipt; mocked policy/dedup tests |
| Book My Child's Seat | memory_offer_click | Existing handler reused; real component handler tested with mock hooks |
| Parents class-selection CTA | memory_track_selected | Existing name retained; grade/track excluded from Meta; policy test |
| Priced Parents offer visible | memory_offer_view | Existing observer added; visibility/permission mock tests |
| /memory-challenge/video/school and /advanced | PageView, memory_offer_view, memory_offer_click | Adult marketing surfaces only with verified adult receipt; policy/dispatch tests |
| /memory-challenge selector | PageView, memory_track_selected | Withheld from Meta: mixed student context; application selection preserved |
| /memory-challenge/start and /test | PageView, test/module events | Withheld from Meta: student context; scoring unchanged |
| Saved assessment completion | memory_test_completed | Existing application analytics only after successful session persistence; Meta withheld |
| Scoring-only fallback | memory_test_completed | No completion event; result remains available |
| /memory-challenge/result, including embedded offer | PageView, result/Lead/offer events | Withheld from Meta; no hashed student identifier; UI/booking still work |
| Assessment-linked Razorpay opening | InitiateCheckout | Withheld in student route, even with inherited receipt |
| Adult marketing Razorpay opening | InitiateCheckout | Existing server order, 9900 paise/INR and successful open required; per-order dedup |
| Opening/abandoning/failing checkout | Purchase | Never emitted by browser; mocked component and webhook tests |
| /memory-masterclass/thank-you | Purchase / PageView | Neither sent by browser; redirects and query payment IDs are not proof |
| Signed verified captured payment | Purchase via CAPI | Existing captured-payment and permission gates; actual webhook/serializer with mocks |
| CAPI failure/retry | Same Purchase event_id/time | Bounded retry and concurrent claim tests |
| Retest / unknown future Memory route | Any Meta event | Withheld by default |
| Vocabulary / Spoken English / German | Existing events | Existing baseline output and boundary tests; no product code changed |
| WhatsApp | Existing workflows | No workflow code changed; backend harness throws on unexpected non-Memory side effects |

Commercial browser payloads are allowlisted: fixed funnel/source/product,
99/INR/one item and the fixed content name. No grade, student identity, scores,
answers, assessment IDs, owner tokens or arbitrary nested fields. URLs with
private/unknown query parameters or unknown fragments are withheld because Pixel
also includes the document URL. Public anchors top/choose-grade/booking are safe.
Do not add student IDs to UTMs; their values are still part of the page URL.

## Purchase policy: existing consent remains the only implemented authorization

The patch does not set consent true, introduce a policy flag, change price or
product, modify webhook/accounting, migrate schema, alter retries or resend old
records. Purchase remains memory_masterclass_99_purchase_<Razorpay payment ID>,
value 99, INR, product memory_masterclass_99, destination 1998316064175555.
FluencyJet destination 1246171816816642 is never a Memory fallback.

### Conditional proposal — NOT IMPLEMENTED OR ENABLED

A separate server-only purchase policy is technically possible, but cannot be
approved by an engineering change. Before implementation, the responsible
privacy reviewer must confirm applicable jurisdictions, legal basis, notices,
Meta requirements, opt-outs and how the current adult purchaser is established.
Successful payment, a privacy-policy acknowledgement or Razorpay usage is not
advertising consent.

If approved later, add an independent prospective authorization decision at
checkout-intent creation and recheck before each send. Store its policy version,
source, decision time, adult-purchaser evidence and refusal/withdrawal revision
separately from browser consent. Do not overload metaConsentGranted. A proposed
policy flag must default off and require a version plus activation timestamp;
missing evidence, known minor, restriction, refusal or withdrawal wins. Do not
claim this can be switched on without any subsequent design/schema review.
Allow only the captured adult purchase and approved adult matching fields, never
assessment/browser identity. Restrict to new intents after activation; never scan
or requeue historical SKIPPED_CONSENT/declined rows. Keep stable event IDs and
existing delivery outcomes/retries. No flag or authorization path is added here.

## Final release review — verified test results

This section supersedes the initial 75-test review. No production settings,
consent records or customer data were accessed or modified. Production SHAs
were rechecked and remain exactly the baselines above.

| Check | Result | Scope |
|---|---|---|
| Full frontend production build | PASS | Exact repository client lockfile, npm ci without lifecycle scripts in scratch, sanitized environment, npm run build; all 916 modules compiled |
| Existing/new frontend unit and safety regressions | 161 PASS | All fetched lib/memory/config tests, QA isolation/receipt policy/navigation tests |
| Existing backend Jest regressions | 158 PASS | Six suites: schedule, checkout, consent, delivery, destination and Razorpay attribution; includes expired-event rejection for both order routes |
| Actual component-handler and CAPI/webhook VM tests | 18 PASS | Existing PR tests; all provider/DB operations mocked |
| Network parser tests | 9 PASS | Existing Python parser suite |
| Rendered production-bundle Chromium tests | 12 PASS | Desktop 1280px, mobile 390px, schedule/expiry, Pixel owner, privacy, CTA, class selection/navigation, popup, mocked Razorpay, failed order, other three products |

Total: **358 passing tests**, plus the successful full production build.
The final rendered run uses the lockfile-built production bundle. No real
payment or Meta HTTP request is made. Three legacy attribution test expectations
were parameterized over school/advanced tracks; four old assertions expecting
browser identifiers were updated to assert their deliberate removal, while
adult-contact and payment assertions remain. Checkout tests freeze a test clock
before the configured class; two new tests advance beyond it and verify 409
before either provider or assessment-database access. Fake dates are test-only.

Commands from repository root:

```sh
npm --prefix client ci --ignore-scripts --no-audit --no-fund
npm --prefix client run build
node --test client/src/lib/*.test.js client/src/components/memory/*.test.js client/src/data/memory/*.test.js client/tests/runMemoryQa.test.mjs client/tests/memoryNavigationDiagnostics.test.mjs client/tests/memoryReceiptPolicy.test.mjs
node --experimental-vm-modules server/node_modules/.bin/jest --config server/jest.config.js --runInBand memoryMasterclassEvent memoryMasterclassCheckout memoryMetaConsent memoryMetaDelivery metaTracking razorpayPurchaseAttribution
node --experimental-vm-modules --test client/tests/memoryFunnelComponents.offline.mjs server/__tests__/memoryFunnel.offline.mjs
python client/tests/memoryQaNetwork.test.py
# Explicit test-tool locations, not production settings:
BRAINODAD_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs BRAINODAD_CHROMIUM=/path/to/chromium node --test client/tests/memoryRelease.rendered.mjs
```

All application test executions used sanitized environments and fixtures.
Dependencies/tools were installed in scratch; manifests/lockfiles were not
modified. Prisma Client generation used --no-engine, with no DB connection or
migration. Existing namespace runner cannot launch in this host because Linux
user-namespace mapping is denied. It was not weakened. Instead the new rendered
suite serves the real production bundle entirely through request interception,
blocks service workers, fulfills every page request from local files/fixtures,
and forces browser background traffic through a closed proxy. There is no live
HTTP application server or external request continuation. The existing inherited
Chromium suite is not claimed green; the 12 rendered cases cover this
release's stated requirements. External media/images are mocked or use the
application's fallback layout. Visual desktop/mobile screenshots were inspected.

Build warnings about large chunks, confetti imports and old browser metadata
are non-fatal and outside this patch. A real PostgreSQL concurrency test, actual
Meta acceptance/matching, and production delivery-worker flags remain untested.
The mocks cannot prove real provider availability or exactly-once network delivery.

## Scheduling correction and actual production impact

Production frontend has EVENT_DATE = 2026-10-25 and literal October 25 copy;
production backend's sole approved settings also remain October 25, 5–7 PM IST.
The old page can accept that same expired date and show enabled booking; old
order routes do not reject expiry. This is established from deployed source,
not a real booking attempt. If the backend date were updated alone, the old
frontend would reject it because of its fixed-date comparison.

PR #6 now derives all four date/time labels and CTA eligibility from the existing
server-owned event endpoint. Valid start/end and a future start are required.
No rolling-next-Sunday rule or new date is introduced. PR #7 adds the matching
server guard to both Memory create-order routes: no new orders once the approved
class has started. This explicitly closes registration at start time, before
Razorpay is called; previously issued captured payments still use the unchanged
webhook/accounting flow. No other product is affected.

**Approved schedule update (owner confirmation received):** The owner has now explicitly approved Sunday, November 15, 2026,
5:00 PM–7:00 PM IST at ₹99. PR #7 settings use exactly
2026-11-15T17:00:00+05:30 and 2026-11-15T19:00:00+05:30. The
existing WhatsApp group URL is unchanged and still needs owner confirmation.
PR #6 displays the approved server label including the year; both existing
Razorpay descriptions now include the complete date and time range. The rendered
check verifies the exact label, ₹99/INR checkout, and confirmation page with the
actual approved schedule served as a mock API response. A separate synthetic
fixture still tests independence from any hardcoded date.

## Matching provenance decision

Keep PR #7's removal. getMemoryVisitorId reuses the origin's stored visitor ID;
getMemoryFbc prefers shared _fbc cookies and cached click IDs; _fbp is also shared.
Standalone parent and assessment checkouts use the same attribution helper.
Neither receipt nor checkout intent records an independently verified adult-only
browser-identity provenance chain. A parents URL, checkoutContext or school track
is not sufficient to prove an inherited cookie belongs to the adult purchaser.
User agent identifies a browser, not its adult operator. No new provenance model
or tracking architecture is introduced in this review.

Eligible CAPI Purchases still send hashed adult purchaser email/phone, fixed
product/value/currency, stable event ID/time and safe fixed event-source URL.
Without fbc/fbp/external_id/user agent, Meta has fewer matching and direct-click
signals; event match quality and ad attribution may be lower. Delivery success,
identity matching and Ads Manager attribution are distinct, with no guaranteed
match rate. Do not restore child-originated identifiers to improve a score.
A future optional provenance design would require an approved adult-specific
purpose and auditable journey binding, separate from assessment IDs/cookies,
plus a fresh review. It is not necessary to deliver currently eligible Purchases.

## Plain-English measurement answers

1. Meta can receive PageView, memory_offer_click, memory_track_selected,
   memory_offer_view, memory_checkout_open and InitiateCheckout on the allowlisted
   adult marketing routes, only with current verified adult authorization. A
   valid captured eligible payment produces the existing server CAPI Purchase.
2. No student test/module/result/retest or assessment-derived Lead event goes to
   Meta. Saved sessions, answers and scores remain in the application's database.
   IMPORTANT: the unchanged tracking.js helper also invokes existing Google
   Analytics gtag for custom events/page views. Thus these PRs establish
   **Meta exclusion, not a blanket first-party-only guarantee for all analytics**.
   A strict first-party-only assessment-analytics requirement needs a separate,
   explicitly scoped GA decision/change; this review does not silently redesign GA.
3. Both previously skipped October Purchases remain excluded; no records were
   inspected, requeued or sent, and no backfill path was added.
4. Yes, a new purchaser without eligible authorization is still excluded from
   CAPI, even if Razorpay captured and accounting recorded the payment.
5. Existing consent-based reporting needs no new legal-basis policy to send an
   already eligible purchase, but production dedicated-token/worker operation
   must be verified separately without exposing secrets. To broaden eligibility,
   the responsible reviewer must approve the exact basis, geography, adult
   evidence, notice, opt-out/withdrawal and Meta requirements, followed by a
   separately reviewed prospective authorization implementation. A business
   owner's approval to deploy code is not itself the missing legal basis.
6. Evidence is the exact-source baselines, successful lockfile production build,
   358 passing tests and reviewed screenshots. This supports the tested code,
   not live provider availability, a new eligibility policy or live attribution.

**Recommendation: GO for the reviewed schedule/checkout code; HOLD deployment.**
The approved November 15 date is implemented and all tests pass. Owner confirmation
of the unchanged WhatsApp destination and explicit deployment approval remain.
Both PRs stay separate drafts; production is unchanged. Earlier GA/authorization
limits remain documented and are not altered by this scheduling update.

## Release instructions — requires separate explicit deployment approval

1. The November 15 schedule, full build and targeted rendered/regression checks
   are complete. Confirm the unchanged WhatsApp group destination and obtain
   explicit deployment approval; keep both PRs draft meanwhile. If strict
   first-party-only assessment analytics is required, resolve the existing GA
   scope separately before that claim is made.
2. Re-read Railway deployed SHAs. Reconcile drift; do not merge main or deploy a
   frontend branch wholesale as backend. Do not touch the WhatsApp branch.
3. Frontend PR targets feature/brainodad-sticky-scroll-tiles-oct19; backend PR
   targets release/brainodad-parents-oct25. Keep source auto-deploy disabled/pinned
   before merging anything; branch configuration must be checked at release time.
4. After approval, deploy the reviewed frontend SHA to service
   7a8cd65f-a44d-428a-ad42-9fd2557ce017 in project
   3531ed7f-57cf-471a-9c01-0454b3f26ff5, environment
   110a9f93-6843-4a53-b88a-9d5dd4f2125f.
5. Deploy only the reviewed backend SHA to service
   fd85733a-8287-4bf3-b7e3-fbe73879e970 in project
   4eb7ea00-3958-457a-93ac-e43dc377a8e9, environment
   9e9c0086-d0fa-4131-8339-a26213f42d90. Inspect startup migration behavior first:
   this patch requires NONE, and does not authorize pending unrelated migrations.
6. Observe Railway SUCCESS, verify privacy/booking without a real purchase, and
   separately approve any live test event/payment. Do not replay old payments.
7. Roll back frontend to 6e15446706bff98ce494140ee07d951ff72cc0f5 /
   d372278a-80e3-46f1-9d3d-163c0eb98807 and backend to
   5b825a6f1bbf7ecce2592d45fe0f0d282f9f78da /
   c804a2bf-a0b1-42ac-88cf-8fa78fc16998. No database rollback is needed. Restore
   matching pinned source settings so a future push cannot undo rollback.

## Remaining unmeasurable activity

No/expired/withdrawn/unverified permission, known children or uncertain student
assessment activity, sensitive URL contexts, blocked SDKs, missing dedicated
CAPI configuration, exhausted/expired delivery windows and historical skipped
purchases remain unmeasured by Meta. Server worker enablement must be verified
later without exposing secrets. An adult receipt is self-attestation, not an
identity/age-verification system. This change does not promise every payment in
Ads Manager or guarantee identity matching, ad attribution, or exactly-once
network transport; stable IDs support deduplication across retries.


## Exact incremental files for the approved schedule update

PR #6:
- client/src/components/memory/MemoryStandaloneCheckout.jsx
- client/src/components/memory/MemoryMasterclassOffer.jsx
- client/tests/memoryFunnelComponents.offline.mjs
- client/tests/memoryRelease.rendered.mjs
- docs/brainodad-meta-funnel-oct28.md

PR #7:
- server/config/memoryMasterclassEvent.js
- server/__tests__/memoryMasterclassEvent.test.js

The only runtime changes in this incremental update are the approved start/end,
year-inclusive shared date label, and full Razorpay description in the two
existing Memory checkout components. The pre-start booking guard is preserved.
Pixel 1998316064175555, CAPI eligibility, captured-payment verification, price,
other products and WhatsApp workflows remain unchanged. Zero tests failed in
the final run; initial missing local test dependencies were restored in scratch
without changing app manifests or lockfiles. No real provider calls were made.
