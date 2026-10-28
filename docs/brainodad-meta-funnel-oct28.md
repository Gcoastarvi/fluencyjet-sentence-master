# BrainoDad tracking review — 28 October 2026

## Temporary adult-purchase policy — implemented, DISABLED pending approval

This section supersedes earlier consent-only proposal and no-migration statements
below. Both existing PRs remain drafts. No production settings, records, secrets,
migrations or deployments were accessed or changed. The owner has now confirmed
the existing WhatsApp group; it is unchanged. The approved November 15, 2026,
5–7 PM IST schedule and ₹99 price are preserved.

### Behavior and safeguards

Two independent server eligibility paths reuse the existing delivery worker:
current verified adult consent, OR a currently approved alternative adult-purchase
policy. Refusal, withdrawal, GPC, an explicit underage/other/uncertain declaration,
identity mismatch or legal/platform restriction blocks sharing. A known refusal
wins over either path. Buyer-linked existing declined/withdrawn receipts are
looked up read-only; historical purchases are never requeued. Refusals recorded
against normalized email/phone apply to either matching contact. An anonymous
browser refusal cannot be linked to an unrelated device/identity without contact
evidence; no system can promise otherwise. No public API can unblock refusals.
A future renewed authorization after refusal needs a separately reviewed process.

Only Parents checkout can obtain a prospective alternative token. The adult
explicitly declares parent/guardian, age 18+, India and use of their own contacts;
this is self-attestation, NOT verified age, residency, identity or contact ownership.
Unknown/other selections never qualify. Payment and visiting a Parents URL are
not evidence of adult identity or advertising consent. If a reviewer requires
stronger verification, this implementation must stay disabled until that narrow
verification change is reviewed. Assessment-linked checkouts cannot use the
alternative path; no assessment answers, scores, student identity or inherited
fbc/fbp/external ID/UA/IP is sent to Meta.

Policy presentation exposes only approved notice metadata, never approval records.
Active mode removes the advertising checkbox, shows the exact short notice and
Privacy Policy link, an optional adult/own-contact declaration, and accessible
measurement refusal/withdrawal. Disabled, expired or unavailable policy restores
the existing optional adult-consent control under Privacy choices. Payment works
in either state without opting in. The alternative never grants browser consent
or boots Pixel. An existing valid browser consent remains a separate browser rule.
Withdrawal revokes retained bearer authorizations; failed server withdrawal is
shown as pending, not falsely confirmed. Storage failure prevents using an
alternative token. Cross-device withdrawal needs the existing support/privacy
channel and contact verification; approval must cover that operational process.

The audit stores policy version/effective/expiry/review dates, authorization source,
legal/Meta/adult-evidence approval references, notice version/hash, explicit adult
self-declaration, receipt revision where supplied, and refusal/withdrawal state.
Contact hashes are pseudonymous personal data, not anonymization. Approve access,
retention/deletion and rights handling for these records before activation.

Signed payment.captured still creates exactly one accounting row per payment;
authorized new purchases become PENDING and use the existing CAPI serializer,
leases, retry window and stable payment-derived event ID. Authorization and the
live DB switch are checked again before each transport attempt. Errors withhold
measurement without stopping payment. Policy disable/expiry makes pending
alternative-only rows SKIPPED_CONSENT; they are not revived later. A kill switch
cannot recall an already in-flight or accepted event. Exactly-once HTTP delivery
cannot be guaranteed after a lost response; the unchanged event ID supports Meta
deduplication. Previously SKIPPED_CONSENT purchases, including October's two,
remain excluded.

### Approval required BEFORE enabling

1. A dated legal/privacy determination identifies the actual alternative lawful
   authorization, its scope/jurisdiction and applicable restrictions. The Indian
   commencement timetable alone is not such authorization; assess other currently
   applicable duties as well. Approve self-declared adult/India/own-contact
   evidence explicitly, or keep disabled pending stronger evidence.
2. Review and retain the applicable current Meta Business Tools Terms, account /
   dataset restrictions, required notices, choices and any consent requirements.
   Confirm the actual proposed sharing and Meta's own advertising uses are
   permitted. If those requirements require consent or prohibit this sharing,
   the alternative must remain disabled. metaApprovalRef is a recorded qualified
   terms-review reference, NOT an invented Meta approval or a Meta API permission.
   Obtain any separate written platform permission if the applicable terms need it.
3. Approve the exact implemented notice (including hashed adult email/phone,
   purchase details, Meta own uses, no student data, optional measurement,
   withdrawal, and separate browser policy), publish a matching full Privacy
   Policy with controller/contact, purposes, recipients, authorization, rights,
   retention and withdrawal/support information. The code's existing policy link
   alone does not establish that the linked policy has been legally updated.
   An approved text change requires matching code notice/hash/version and record.
4. Owner separately approves activation and release. No policy record is seeded,
   no approval references are fabricated, and no production switch is enabled.

Primary timing source: MeitY notification G.S.R.843(E), November 13, 2025:
https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf
The relevant staged commencement is eighteen months. This is timing evidence,
not approval of Meta sharing. Current Meta terms pages
https://www.facebook.com/legal/technology_terms and
https://www.facebook.com/legal/terms/businesstools could not be retrieved without
an access/sign-in barrier during review; a dated current terms review remains
an explicit blocker. Do not substitute assumptions about their contents.

### Exact configuration and operator actions — NOT executed

An additive migration is required: 20261028180000_memory_adult_purchase_policy.
It adds purchaseMeasurement JSON to checkout intents and two policy/evidence
tables. No historical updates, replay or enabled seed. At an approved release,
review pending migrations, apply only the reviewed migration through the existing
release process, regenerate Prisma client, then deploy backend before frontend.
Do not start new code against an unmigrated schema. No production migration or
production database integration test has been performed here.

After the above approvals, an authorized operator prepares an approved JSON file
with the following fields (the placeholders are not usable approvals):

```json
{
  "id": "<approved-immutable-version>",
  "scope": "IN_ADULT_PARENT_SELF_ATTESTED",
  "effectiveAt": "<approved-ISO-date-with-timezone>",
  "expiresAt": "<approved-ISO-date-no-later-than-2027-05-13T00:00:00+05:30>",
  "reviewDueAt": "<approved-review-date-before-the-deadline>",
  "legalApprovalRef": "<dated-legal-review-reference>",
  "metaApprovalRef": "<dated-current-Meta-terms-review-reference>",
  "adultEvidenceApprovalRef": "<explicit-self-attestation-adequacy-review>",
  "authorizationSource": "<actual-approved-authorization>",
  "noticeVersion": "memory_adult_purchase_v1",
  "noticeHash": "<exact-hash-printed-by-notice-command>",
  "restrictionsCleared": true
}
```

Commands from repository root (operator-only; no public approval endpoint):

```sh
node server/scripts/memoryAdultPurchasePolicy.js notice
node server/scripts/memoryAdultPurchasePolicy.js register /secure/approved-policy.json
```

Register always creates a new disabled version; it never replaces an existing
record. Set the backend runtime configuration only after approval:

```text
MEMORY_META_ADULT_PURCHASE_ENABLED=true
MEMORY_META_ADULT_PURCHASE_POLICY_ID=<approved-immutable-version>
```

Retain existing dedicated CAPI destination/token configuration and existing
MEMORY_META_DELIVERY_ENABLED=true worker setting for retries; never expose the
token. MEMORY_META_PURCHASE_SHARING_BLOCKED must not be true. Restart/config
rollout follows the existing hosting process. Then explicitly enable the approved
row with `node server/scripts/memoryAdultPurchasePolicy.js enable <id>`.
Environment flag alone cannot activate this feature: the enabled valid DB policy
and all evidence/notice/time/restriction checks are also mandatory.

Immediate alternative-only stop (DB switch rechecked each attempt):
`node server/scripts/memoryAdultPurchasePolicy.js disable <id>`.
Also set MEMORY_META_ADULT_PURCHASE_ENABLED=false and restart as defense in depth.
Ordinary valid consent-based reporting and payments continue. Emergency global
MEMORY_META_PURCHASE_SHARING_BLOCKED=true with runtime config rollout blocks both
purchase-sharing paths without stopping Razorpay. Do not execute these commands
against production until expressly authorized.

### Deadline, reporting and rollback

Every authorization/delivery check falls back to consent-only at **00:00 IST
May 13, 2027 (May 12, 18:30 UTC)** or the earlier review/expiry date. Database or
environment changes cannot extend this release beyond the hard deadline. A newly
reviewed compliant replacement requires a separate code/privacy review; the
system does not auto-renew authorization. No scheduler or migration is needed
for the deadline check. Existing valid consent still works after the deadline.

Accepted mock log:
`[memory-meta] DELIVERED event=memory_masterclass_99_purchase_pay_fixture dataset=1998316064175555 value=99 currency=INR`
The alternative fixture has metaConsentGranted=false and no old receipt. Mock
transport returns events_received=1; no real Meta event was sent. Eligible live
accepted events can appear in Events Manager; ad attribution and matching are
not guaranteed. Only hashed adult email/phone are available for person matching;
without fbc/fbp/browser provenance, direct-click attribution and match quality
may be weaker. Meta can potentially match that adult to an account; hashed
contacts do not make the purchase anonymous. Pixel/browser events retain their
existing separate consent rules.

Rollback: disable the DB policy, then environment switch; roll back the two
services to their exact reviewed prior commits using the existing release
process. Leave additive tables/column and audit records in place; do not drop
privacy evidence. No historical payment reversal or WhatsApp change is needed.
Recheck deployed SHA/source drift and auto-deploy settings before any release.

Exact incremental files (existing PRs only):

- PR #6: client/src/components/memory/MemoryMetaConsent.jsx,
  MemoryPurchaserDetails.jsx, MemoryStandaloneCheckout.jsx;
  client/src/lib/memoryPurchaseMeasurement.js and its .test.js;
  client/tests/memoryRelease.rendered.mjs; this document.
- PR #7: server/services/memoryAdultPurchasePolicy.js, memoryMetaConsent.js,
  memoryMetaDelivery.js; server/routes/memoryMetaConsent.js,
  memoryMasterclassCheckout.js, memoryMasterclassStandaloneCheckout.js,
  webhookRazorpay.js; server/prisma/schema.prisma and the named migration SQL;
  server/scripts/memoryAdultPurchasePolicy.js; server/__tests__/
  memoryMasterclassCheckout.test.js, memoryMetaDelivery.test.js,
  razorpayPurchaseAttribution.test.js, memoryFunnel.offline.mjs.

Final checks for this incremental implementation: 158 backend regression tests,
164 frontend/unit/safety tests, 38 actual-handler/component offline tests,
15 rendered production-browser tests, production frontend build and Prisma schema
validation. No test failures in final runs; inherited build chunk-size warnings
remain. Browser covers both policy states, existing consent, refusal, layout,
November schedule, mocked checkout and other product dataset isolation. Backend
covers actual signed captures/serializer, stable ID/value/dataset, retries,
refusal/withdrawal/GPC/history, unknown/child, fail/duplicate, live switches and
May 13 fallback. These are offline mock results, not a live-provider, migration
application or production-database test.

**GO for review of the disabled implementation; NO-GO for activation/deployment
until the approvals, matching Privacy Policy publication, reviewed migration,
and explicit deployment approval are complete.**


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
existing WhatsApp group URL is unchanged and has now been confirmed by the owner.
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
The approved November 15 date is implemented and all tests pass. The owner has confirmed the unchanged WhatsApp destination; explicit deployment approval remains.
Both PRs stay separate drafts; production is unchanged. Earlier GA/authorization
limits remain documented and are not altered by this scheduling update.

## Release instructions — requires separate explicit deployment approval

1. The November 15 schedule, full build and targeted rendered/regression checks
   are complete. The unchanged WhatsApp group is owner-confirmed; obtain
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
   the temporary policy update now requires the additive migration documented above; unrelated migrations are not authorized.
6. Observe Railway SUCCESS, verify privacy/booking without a real purchase, and
   separately approve any live test event/payment. Do not replay old payments.
7. Roll back frontend to 6e15446706bff98ce494140ee07d951ff72cc0f5 /
   d372278a-80e3-46f1-9d3d-163c0eb98807 and backend to
   5b825a6f1bbf7ecce2592d45fe0f0d282f9f78da /
   c804a2bf-a0b1-42ac-88cf-8fa78fc16998. Leave the additive policy schema and audit evidence intact on rollback. Restore
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
