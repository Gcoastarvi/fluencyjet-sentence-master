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

## Verification actually performed

75 focused offline tests pass:

- 57 browser-API/consent/navigation/dataset/dedup tests using mocked window/SDK.
- 6 actual component-handler/observer tests with mocked React hooks, DOM,
  Razorpay and API: open ordering, failed order/open, no-choice booking and
  visibility. These are NOT a rendered Chromium end-to-end suite.
- 12 dependency-free VM tests execute the actual backend webhook, delivery,
  consent and CAPI serializer with mocked Prisma, Express router and HTTP.
  They cover signatures, captures, duplicates, permission/age/refusal, retries,
  claims, stable values/IDs/destination, child-field exclusion and no backfill.
- Three modified JSX components parse successfully with the existing runtime's
  Babel parser. This is not a full Vite build.

Commands from repository root (sanitized shell / test fixtures only):

```sh
node --test client/src/lib/memorySavedCompletion.test.js client/src/lib/memoryBrowserPolicy.test.js client/src/lib/metaPixel.test.js client/src/lib/memoryMetaConsent.test.js client/src/lib/memoryCheckoutConsent.test.js client/src/lib/funnelDocument.test.js
node --experimental-vm-modules --test server/__tests__/memoryFunnel.offline.mjs
node --experimental-vm-modules --test client/tests/memoryFunnelComponents.offline.mjs
```

Component tests use the project's installed Vite transformer. In the inspection
workspace, where project packages were unavailable, an existing runtime Babel
bundle was supplied via BRAINODAD_QA_BABEL_BUNDLE. No new dependency is required.
An attempted isolated test-package download was stopped when unavailable; no
application packages or lockfiles changed. The full inherited Jest suite,
rendered browser suite, build, live Meta matching and production worker settings
are NOT verified. Mocked leases/uniqueness are not a real PostgreSQL concurrency
test. Storage-blocked browsers may have weaker browser dedup; server payment
dedup remains authoritative. These limitations are release-review blockers for
claiming complete end-to-end validation, not evidence that the focused tests failed.

## Additional production issue, intentionally unchanged

Parents currently checks EVENT_DATE = 2026-10-25. Today is October 28. A newer
event response can leave paid buttons disabled through the existing date guard.
Confirm scheduling separately; do not remove that guard or silently change the
class date in a tracking patch.

## Release instructions — requires separate explicit deployment approval

1. Keep both PRs draft until rendered-browser QA/full client build and scheduling
   review are complete. Use only mocked APIs/providers and isolated test envs.
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
