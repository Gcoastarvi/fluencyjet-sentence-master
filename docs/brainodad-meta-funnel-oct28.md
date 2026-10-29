# BrainoDad independent Purchase eligibility gate — 29 October 2026

## Exact release status

Existing PR #6 and PR #7 remain separate drafts. NO merge, production migration,
deployment, activation, secret/customer access or historical replay occurred.
The owner has explicitly NOT approved deployment of the consent-only version.
No such deployment is proposed or performed here.

The backend now has two independent eligibility branches: current valid adult
consent OR a prospective alternative-policy decision. The alternative branch
never requires or sets metaConsentGranted=true and never requires an old receipt.
It uses the existing webhook, accounting, CAPI serializer, leases, retries,
deduplication and delivery outcomes.

**Important limit:** no specific legally/Meta-approved non-interactive adult /
child-exclusion rule has been supplied. Production memoryPurchaseRule.js therefore
returns APPROVED_RULE_NOT_IMPLEMENTED, with rule version UNIMPLEMENTED. It cannot
be enabled by configuration, even if approval-like strings are filled in. The
positive tests replace that rule MODULE with an explicitly synthetic offline
fixture. They prove the gate/transport behavior, NOT legal eligibility, real age
verification or live Meta acceptance. This is a prepared gate with a clearly
identified missing rule, not a fully activatable business solution.

No preverified records, adult registry, manual verification script, customer login,
adult declaration, new checkbox/dropdown or replacement verification workflow is
created. The Parents UI is unchanged from the clean checkout already reviewed:
Name, Email, Phone, short disclosure, Privacy Policy, accessible measurement
choices, Continue to Payment — ₹99 and existing Cancel. Pay/URL/policy link are
not advertising consent or proof of adulthood. Other checkouts keep their own
existing controls. Browser Pixel consent remains separate.

## Implemented flow

1. For a NEW standalone Parents order, retain the existing genuine consent snapshot.
   Separately record a prospective purchaseAuthorization JSON audit: refusal/GPC /
   uncertain or minor markers, creation time, order/contact fingerprint, approved
   policy metadata and a rule-evaluation reference when eligible. Browser-supplied
   adult/permission/policy objects cannot populate this server audit.
2. Evaluate only a current enabled policy with genuine review references, exact
   notice hash, matching implemented rule version and effective/review/expiry dates.
   The rule must establish adult purchaser/own-contact eligibility, exclude children,
   check current refusals/withdrawals and platform permission. It receives only
   permitted purchaser/order fields, never assessment data or inherited identifiers.
3. After actual signed Razorpay payment.captured, record the payment once. Queue
   authorization independently of metaConsentGranted. Missing/ineligible permission
   uses existing SKIPPED_CONSENT reporting; that status name is retained for
   compatibility. If authorization checking is temporarily unavailable, preserve
   an already prospective candidate for retry, without sending unchecked.
4. Before EVERY transport attempt, recheck current refusals/withdrawals, current
   policy version/metadata, order/purchaser binding, expiry and the trusted rule.
   Existing valid adult consent is an independent branch. Refusals/restrictions win.
5. Use existing Purchase identity, transport, retry lease/window and outcome fields.
   Record rejection reasons in metaLastErrorCode; successful safe logs include the
   chosen source adult_consent or approved_alternative. Rule/DB outages retry through
   existing worker handling. Policy-disabled/expired candidates are skipped, not
   revived by later enabling/reapproval. Historical skipped rows lack a prospective
   audit and remain outside worker selection.

Dataset 1998316064175555; Purchase; value 99; currency INR;
product memory_masterclass_99; event ID memory_masterclass_99_purchase_<paymentId>.
No FluencyJet destination fallback. No browser Purchase, CTA Purchase, failed-pay
Purchase or thank-you Purchase. No scores/answers/student identifiers/assessment
IDs or inherited fbc/fbp/external ID/UA/IP go to Meta. Permitted adult purchaser
email/phone are the matching inputs; hashing is pseudonymization, not anonymity.

The approved November 15, 2026 5–7 PM IST ₹99 webinar, pre-start order guard and
confirmed WhatsApp group are unchanged. Other FluencyJet/WhatsApp code is unchanged.

## Missing authorization and rule — precise blocker

The reported legal advice concerns omitting separate checkout controls. It does
not provide the actual authorization to share new purchasers' identity/payment
information with Meta for advertising measurement without individual opt-in.
Before the production rule can replace its explicit denial, obtain:

- A dated legal determination of the specific alternative authorization, permitted
  purchasers/jurisdiction/scope, purposes, prospective effective/expiry and review.
- Current applicable Meta Business Tools Terms and account/dataset restrictions
  review, including Meta's uses, required permissions, disclosures and choices.
  A reference string is not evidence that such review actually happened.
- Exact approved short notice (hashed in the implementation) and matching published
  full Privacy Policy: recipients/purposes/authorization, Meta uses, rights/contact,
  withdrawal and retention. Existing link alone does not establish adequacy.
- The actual supportable non-interactive adult/own-contact and child-exclusion rule,
  its inputs, permitted use and current refusal/withdrawal handling, including how
  receipt-free buyers' withdrawal is identified before a queued send. Typed contacts,
  Indian phone format, parent-oriented URL, ad arrival and ₹99 payment do not by
  themselves supply adult identity evidence. No replacement verification workflow
  is invented to fill this gap. If supportable inputs/rule are unavailable under the
  requested UX, unknown buyers must remain ineligible.
- Explicit owner approval of the rule implementation/release and later activation.

Then implement/test precisely that rule in the small server rule module. Current
booleans in its TEST fixture are not an acceptable production replacement. The
rule must derive findings from approved supportable inputs and current privacy
state, never trust browser claims or just return true for every Parents checkout.
An approval memo alone cannot make the UNIMPLEMENTED module operational. The
needed follow-up is a narrow rule integration after approval, not a Pixel or
checkout rebuild. No claim of lawful eligibility is made by the gate itself.

Official Meta terms retrieval previously met an access/sign-in barrier; current
terms compatibility remains unverified:
https://www.facebook.com/legal/technology_terms
https://www.facebook.com/legal/terms/businesstools
DPDP commencement timing is not independent authorization for Meta sharing:
https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf

## Configuration and rollback — NOT activated

Default OFF: MEMORY_META_ADULT_PURCHASE_ENABLED is absent or false.
The independent alternative kill setting is:

```text
MEMORY_META_ADULT_PURCHASE_ENABLED=false
```

It is checked at each order/capture/delivery evaluation. Setting it false in the
running process stops subsequent alternative attempts; valid consent and payments
continue. Hosting environment changes must actually be applied to running processes
(usually a config rollout/restart); this is not a separate instantaneous remote
kill service. Already in-flight/accepted events cannot be recalled. Existing
MEMORY_META_PURCHASE_SHARING_BLOCKED=true blocks ALL purchase sharing independently.
No configuration was changed, and no new policy was activated.

ONLY after the missing rule/approvals and explicit owner activation approval,
a future operator would set ENABLED=true with the approved metadata below:

```json
{
  "version": "<genuine-approved-policy-version>",
  "ruleVersion": "<exact-reviewed-implemented-rule-version-not-UNIMPLEMENTED>",
  "authorizationSource": "<actual-approved-authorization>",
  "legalApprovalRef": "<dated-review-reference>",
  "metaTermsReviewRef": "<dated-current-Meta-review-reference>",
  "noticeApprovalRef": "<approved-exact-notice-and-published-policy-reference>",
  "childExclusionApprovalRef": "<approved-adult-child-refusal-rule-reference>",
  "noticeHash": "<SHA256-of-MEMORY_PURCHASE_NOTICE>",
  "effectiveAt": "<approved-ISO-time-with-zone>",
  "expiresAt": "<approved-time-no-later-than-2027-05-13T00:00:00+05:30>",
  "reviewDueAt": "<approved-review-time-before-the-hard-deadline>"
}
```

This is MEMORY_META_ADULT_PURCHASE_POLICY_JSON. No populated example or fake
approval is shipped. Metadata must match the saved prospective decision and actual
implemented rule version. Changing policy invalidates earlier alternative audits;
no historical requalification/backfill. Preserve existing dedicated CAPI transport /
worker configuration, including its retry worker setting. Do not expose secrets.

Hard fallback: May 13, 2027 00:00 IST = May 12 18:30 UTC, or earlier policy review /
expiry. Alternative eligibility stops at that point even for pending retries.
Existing current adult consent remains usable. No env/database date can extend
this release. A separately reviewed compliant successor requires code/privacy review.

## Migration and exact files

One additive migration is now necessary for auditable prospective decisions:
server/prisma/migrations/20261029120000_memory_purchase_authorization_audit/migration.sql
adds ONLY nullable purchaseAuthorization JSONB to the existing checkout-intent table.
No new tables, customer registry, seeds, historical updates or default approval.
Prepared and schema-diff checked OFFLINE ONLY; not applied to any database.
At an explicitly approved future release, reconcile pending migrations and apply
only the approved migration through the existing process; regenerate Prisma client
before new backend code. Do not deploy new field references to an old schema.

Incremental files in existing draft PR #7:

- server/services/memoryMetaConsent.js
- server/services/memoryPurchaseRule.js (explicit production denial pending rule)
- server/services/memoryMetaDelivery.js
- server/routes/webhookRazorpay.js
- server/routes/memoryMasterclassStandaloneCheckout.js
- server/prisma/schema.prisma
- the migration SQL above
- server/__tests__/memoryFunnel.offline.mjs
- server/__tests__/memoryMasterclassCheckout.test.js

PR #6 changes only this review document in this increment. Checkout and Pixel UI
are untouched. Prior PR baselines remain separate, not replaced with main.

Rollback: set alternative ENABLED=false and apply runtime config; if needed use
existing global sharing stop. Roll back each service's own reviewed commit through
the existing release process. Leave the nullable additive column/audit evidence
in place; do not drop records or reverse accounting. No historical sends on rollback.
No deployment/merge/migration is authorized by this document or its tests.

## Final offline proof

| Check | Result |
|---|---|
| Backend schedule/checkout/consent/delivery/destination/attribution regressions | 166 passed |
| Frontend unit/privacy/safety regressions | 164 passed |
| Actual signed webhook/CAPI serializer and component offline tests | 46 passed |
| Rendered production-bundle browser checks | 15 passed |
| Existing network parser | 9 passed |
| Full frontend production build | PASS; inherited chunk-size warnings |
| Prisma validation and schema-only SQL diff | PASS; exactly one nullable JSONB column |

400 passing focused tests, zero final failures. No live payments or Meta requests,
production credentials, customer data or real database integration tests.

Positive alternative proof uses one shared mocked accounting ledger: ten unique
new payments, ten unique accounting rows, ten unique stable event IDs and ten
accepted mocked CAPI transport attempts, WITHOUT old receipts and with
metaConsentGranted=false. Duplicate webhooks do not increase either count.
Synthetic refs are labeled OFFLINE and rule results are supplied by a MOCK MODULE,
never production configuration. Negative proof: another shared ledger records ten
unqualified new payments and zero CAPI calls. Actual production-rule test proves
configuration alone cannot authorize them.

Additional proof: each missing adult/child/contact/platform/withdrawal rule finding
withholds; known refusal/minor/GPC/withdrawal is blocked; approval/notice/version /
order binding is checked; failed payment produces no purchase; transient CAPI
failure retries with the same ID/time; auth outage preserves accounting/retry;
kill/expiry/review dates stop retries; consent remains independent after deadline;
historical missing-audit/skipped rows are not backfilled. Browser still has no
checkbox/dropdown/declaration, normal mocked Razorpay opens, accessible choices,
approved schedule, responsive layout and other-product Pixel isolation.

Accepted MOCK example:
`[memory-meta] DELIVERED event=memory_masterclass_99_purchase_pay_new_0 dataset=1998316064175555 value=99 currency=INR source=approved_alternative`
This does not establish live Meta acceptance, matching or Ads Manager attribution.
Stable IDs support deduplication after lost HTTP responses; exactly-once network
transport is not guaranteed. Real reporting needs a separately authorized live test.

## Final recommendation

GO for review of the tested independent gate and prepared migration.
NO-GO for release/activation as the requested automatic no-opt-in solution until
actual authorization, a supportable reviewed rule and its production implementation
are complete. Do NOT deploy the consent-only version as a substitute for the
owner's requested outcome. Both PRs stay DRAFT. Nothing deployed or activated.


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

