# BrainoDad final simplified release review — 28 October 2026

## Decision and business outcome

Existing PR #6 (frontend) and PR #7 (backend) remain separate drafts. The
preverified-record approach is abandoned and REMOVED, rather than replaced with
another verification or authorization architecture. This document supersedes
all earlier policy proposals and activation instructions.

Parents checkout remains Name, Email, Phone, short privacy disclosure, Privacy
Policy link, accessible inline Privacy choices, Continue to Payment — ₹99 and
the existing Cancel action. There is no advertising checkbox, purchaser dropdown,
replacement declaration, mandatory question, account requirement or verification
workflow. Existing voluntary measurement controls remain accessible through the
linked Memory Challenge privacy page. The Parents form never grants consent.

For ten first-time buyers with no valid measurement authorization and ten genuine
captured payments: TEN internal payment records, ZERO Meta Purchase transmissions.
Repeated webhooks do not add records. This is the demonstrated mock outcome,
not an inspection of ten production customers. An individual buyer who separately
provides valid adult measurement consent through existing choices can qualify;
being new does not itself exclude them. Payment never grants permission.

Automatic CAPI delivery for currently authorized adult purchases is retained.
A new alternative authorization for ordinary new buyers WITHOUT individual opt-in
has NOT been established or implemented. No environment flag can enable it.
A generic lawyer approval to remove checkout controls does not establish that
Meta may receive purchaser identity and payment data for advertising purposes.
There is no newly invented adult classification or evidence requirement here.

## Removed draft-only functionality; no migration needed

Deleted entirely:

- server/services/memoryAdultPurchasePolicy.js
- server/scripts/memoryAdultPurchasePolicy.js
- server/prisma/migrations/20261028180000_memory_adult_purchase_policy/migration.sql
- Draft MemoryAdultPurchasePolicy and MemoryAdultPurchaseAuthorization models.
- Draft checkout purchaseMeasurement JSON field.
- Purchase-policy / authorization / evidence registration / withdrawal endpoints,
  tokens, client requests and operator commands.

Prisma schema is restored to the exact pre-policy PR #7 schema. Offline
schema-to-schema diff reports an EMPTY migration. No database migration is
necessary for this final increment. Nothing was migrated previously in this
session, so removal only removes draft source; no production tables, records or
consent history were altered or dropped. If a release operator discovers an
independently applied version elsewhere, stop and reconcile schema drift; do not
infer authorization to drop tables or evidence.

Existing consent, checkout-intent, purchase and delivery outcome fields remain.
Refusal/GPC handling now uses those existing fields and receipt revisions. Current
buyer-linked declined/withdrawn receipts are checked read-only. Explicit future
user withdrawal uses the EXISTING consent endpoint, not a new record registry.
No consent is manufactured, silently granted, or bulk-rewritten.

## What remains working

The existing signed Razorpay payment.captured webhook records genuine matching
payments once, with its stable payment-derived event ID. Eligible adult consent
queues the existing CAPI worker; that worker checks current consent again before
sending, preserves lease/concurrency handling, bounded retry and delivery outcomes.

Fixed event: Purchase; value 99; currency INR; product memory_masterclass_99;
dataset 1998316064175555. No fallback to FluencyJet dataset 1246171816816642.
No browser Purchase, booking-click Purchase, failed-payment Purchase or
thank-you-page Purchase is added. No student scores/answers/identifiers or
assessment-derived fbc/fbp/external ID/UA/IP enter the CAPI payload.

Missing/expired/non-adult/refused/withdrawn permission is withheld. Known checkout
refusal, GPC and compatible explicit minor/uncertain markers deny an order's
measurement snapshot. A consent-service failure denies measurement while allowing
normal order creation. Current consent revision/adult status is checked again at
delivery; old permission cannot authorize an order after withdrawal/regrant.
Historical SKIPPED_CONSENT rows remain outside the worker's pending/retry query.
No historical events are sent, modified or replayed.

The existing purchase emergency configuration remains:
MEMORY_META_PURCHASE_SHARING_BLOCKED=true blocks both new queue eligibility and
subsequent delivery without stopping Razorpay payments. Apply only via an approved
runtime configuration rollout. This cannot recall already accepted/in-flight data.
Existing dedicated CAPI destination/token and MEMORY_META_DELIVERY_ENABLED worker
configuration remain unchanged; no production variables or secrets were read.

The abandoned MEMORY_META_ADULT_PURCHASE_ENABLED / POLICY_ID settings have no
code path and cannot authorize anything. The system is consent-only NOW and on
May 13, 2027. Thus no alternative can continue beyond that deadline. Any future
specifically approved prospective policy needs a small separately reviewed
implementation, including expiry/May transition safeguards; it cannot be activated
by flipping a leftover flag. Do not resurrect the discarded verification system.

The approved webinar stays Sunday November 15, 2026, 5:00 PM–7:00 PM IST, ₹99.
Both existing order routes still stop new bookings once the event starts. Existing
captured payments are still accounted for. Owner-confirmed WhatsApp group and
other FluencyJet products/workflows are unchanged.

## Exact missing authorization — no new workflow proposed

The reported legal advice covers omitting checkout controls. Before any different
prospective sharing rule is implemented or enabled, obtain a dated determination
answering this concrete question:

May BrainoDad send a NEW purchaser's hashed email/phone and verified ₹99 Purchase
to Meta for advertising measurement without individual opt-in? If yes, what
specific authorization, applicable jurisdiction/scope, required notices/choices,
and implementable purchaser/child-exclusion criteria make that permitted?

The determination must cover Meta's applicable current Business Tools Terms,
account/dataset restrictions and Meta's uses of that data, not only Indian privacy
law or checkout design. It must specify how the rule avoids transmitting known
or reasonably apparent children's information without assuming adulthood from
Pay, a phone number, policy acknowledgement or the Parents URL. No manual
verification, registry, login or declaration is proposed as a replacement.
If the approved arrangement cannot supply a supportable rule, continue withholding
unconsented/unauthorized purchases while accepting payments normally.

Approve the exact short disclosure and full Privacy Policy, including controller /
contact, advertising purpose, Meta recipient/uses, actual authorization, rights,
withdrawal and retention. A link alone is not approval of its destination text.
The owner must separately approve deployment and any future activation.

Official Meta terms pages previously hit an access/sign-in barrier, so current
terms compatibility has NOT been verified by this implementation:
https://www.facebook.com/legal/technology_terms
https://www.facebook.com/legal/terms/businesstools
The staged Indian commencement notification is timing information, not Meta
sharing authorization:
https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf

## Funnel and test matrix

| Surface/action | Event | Current Meta eligibility and evidence |
|---|---|---|
| Parents landing | PageView | Existing verified adult consent, dedicated Pixel; responsive rendered tests |
| Book My Child's Seat / ₹99 CTA | memory_offer_click | Existing handler, authorized adult routes; no Purchase |
| Parents class CTA | memory_track_selected | Existing name retained; grade/student fields excluded |
| Visible Parents/VSL priced offer | memory_offer_view | Existing observer, route/consent gates and dedup |
| Adult marketing VSL routes | PageView and offer events | Existing verified adult consent only |
| Selector/start/test/results/retest | Assessment/result events | Withheld from Meta; underlying assessment preserved |
| Saved legitimate assessment completion | memory_test_completed | Existing application analytics only after persistence; withheld from Meta |
| Adult marketing Razorpay opening | InitiateCheckout | Existing order plus successful mocked open required, per-order dedup |
| Assessment route checkout opening | InitiateCheckout | Withheld from Meta on student route |
| Click/open/abandon/fail/thank-you | Purchase | Never emitted |
| Signed captured authorized payment | Purchase CAPI | Actual webhook/serializer mock: accepted stable ID, correct value/product/dataset |
| Signed captured unauthorized payment | None to Meta | Accounting preserved, SKIPPED_CONSENT; ten-buyer test |
| Duplicate webhook / concurrent delivery | Same event ID | One accounting row; lease/retry/dedup regression tests |
| Consent withdrawal / refusal / GPC / minor | No Purchase | Existing receipt state/revision checks and mocked captures |
| Historical skipped purchases | No backfill | Actual worker query excludes them |
| Spoken English / Vocabulary / German | Existing events | Rendered isolation checks retain FluencyJet Pixel only |
| WhatsApp | Existing workflow | No workflow change; VM harness rejects non-Memory side effects |

Meta exclusion is not a blanket first-party-only guarantee for other analytics:
the existing tracking helper also invokes Google Analytics. That unchanged GA
scope is not redesigned or represented as first-party-only by these PRs.

## Final focused verification

| Check | Final result |
|---|---|
| Six backend Jest regression suites | 166 passed |
| Frontend unit/privacy/safety tests | 164 passed |
| Actual signed-handler/CAPI serializer and component offline tests | 24 passed |
| Rendered production-bundle browser tests | 15 passed |
| Existing network parser tests | 9 passed |
| Full frontend production build | PASS; inherited chunk-size warnings |
| Prisma schema validation | PASS |
| Schema diff vs exact pre-policy PR #7 schema | EMPTY; no migration required |

Total 378 passing tests, zero final failures. The removed approach's tests were
removed with its code; test totals are not a claim that abandoned functionality
is retained. No real Razorpay/Meta calls, customer records or production DB tests.
Mocks cannot prove live acceptance, provider availability or ad attribution.
Browser requests are intercepted from the production build/fixtures; service
workers are blocked and background traffic uses a closed proxy. Test environments
are sanitized. No manifests or lockfiles changed.

A–F requested demonstrations: new clean checkout opens mocked Razorpay; signed
capture records once; authorized adult consent delivers accepted mocked CAPI;
no authorization records payment but sends nothing; refusals/withdrawal/minor /
failed/duplicate cases are protected; historical skips remain excluded.

Accepted MOCK log:
`[memory-meta] DELIVERED event=memory_masterclass_99_purchase_pay_fixture dataset=1998316064175555 value=99 currency=INR`
This accepted fixture has genuine valid adult consent. It is NOT an alternative
no-opt-in acceptance and is NOT evidence of a real Meta transmission. Live
accepted events may appear in Events Manager; matching and ad attribution are
not guaranteed. The serializer uses hashed adult contact matching without child
browser identifiers. Hashes are pseudonymous, not anonymous.

## Source baselines, release and rollback

Previously verified production metadata (not refreshed or changed in this cleanup):

| Service | Source branch | Deployed commit |
|---|---|---|
| Frontend | feature/brainodad-sticky-scroll-tiles-oct19 | 6e15446706bff98ce494140ee07d951ff72cc0f5 |
| Backend | release/brainodad-parents-oct25 | 5b825a6f1bbf7ecce2592d45fe0f0d282f9f78da |

PR branches/bases remain separate. Before a separately approved controlled release,
recheck deployed SHAs, source drift, pinned/auto-deploy settings and existing
schema/Prisma generation. Do not deploy main or one service's whole branch to the
other. No migration command is needed or authorized for this final policy cleanup.
Deploy only separately approved reviewed commits through the existing process.
Smoke-test schedule/privacy/booking with no real charge; real payment/event tests
need separate approval. Do not replay old captures or alter worker records.

Rollback restores each service's own previously deployed/reviewed SHA. No schema
rollback or payment reversal is required. Restore pinned source configuration so
future auto-deploy cannot undo rollback. Emergency sharing block remains available.

**GO for review/controlled deployment of clean checkout + consent-only reporting,
subject to explicit deployment approval and normal baseline/schema drift checks.
NO-GO for new automatic no-opt-in sharing: specific authorization is unresolved,
and that alternative path has deliberately not been implemented or activated.**
