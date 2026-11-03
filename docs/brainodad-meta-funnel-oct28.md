# BrainoDad proposed automatic Purchase policy — 29 October 2026

## Implemented; default OFF; no placeholder

PR #7 now runs the REAL deterministic production evaluator
parents-risk-scope-v1. There is no UNIMPLEMENTED return and no substituted rule
module in the positive tests. PR #6 keeps the existing customer-facing flow:
Name, Email, Phone, short disclosure, Privacy Policy, accessible measurement
choices, Continue to Payment — ₹99 and existing Cancel. No checkbox, dropdown,
declaration, login, adult registry or manual purchaser-verification step.

The rule implements the owner's proposed RISK-BASED scope. It explicitly returns
ageVerified=false and records that fact with the alternative audit. Scope
eligibility is not verified age, contact ownership, residency or legal approval.
Live mode remains disabled until genuine specific approval and separate owner
activation. No merge, production migration, deployment, real payment, live Meta
transmission, credential/customer access or historical replay occurred.

## Exact production rule

The alternative can qualify only when ALL checks pass:

1. The actual existing order-creation request has the approved web origin
   https://www.fluencyjet.com and exact /memory-masterclass/parents referrer.
   The frontend supplies a canonical referrer without ad/query identifiers.
   The server derives and signs its OWN flow/contact/event context; a body flag
   or caller-supplied context token cannot establish this context. It is bound to
   normalized contacts, issued time, event and rule version. This proves scoped
   request handling, NOT the human's identity or age. Origin/referrer headers
   can be forged outside normal browsers; approval must address that limitation.
2. Server-owned product memory_masterclass_99, 9900 paise, INR, school_unspecified,
   standalone checkout source and current approved event key match. Assessment
   ownership/session context is absent. The event stays November 15, 2026 5–7 PM
   IST at ₹99; the existing confirmed WhatsApp group is unchanged.
3. Contacts come from the separate purchaser form. Parents never calls the
   assessment checkout-details prefill endpoint. A read-only existence query checks
   for any matching assessment email or canonical phone (including legacy digit
   form). Any match is conservatively excluded, even if it might belong to a
   guardian. Only an existence indicator is retrieved; no answers/scores are read.
4. Explicit minor/child, student/assessment contact-source, assessment ownership,
   student-data or restricted/conflicting request markers block sharing. A positive
   browser adult flag proves nothing. A +91 mobile and valid email are required
   for the proposed Indian-contact market scope; they do NOT prove residence/age.
5. Current refusals, GPC, withdrawals, receipt revision changes and restrictions
   block the alternative. Previously recorded receipt-free refusals also block
   future matching-contact orders. New Parents assessment-contact conflicts also
   block inherited-consent reporting. Existing valid consent remains independent.
6. The policy is enabled, in scope IN_ADULT_DIRECTED_PARENTS_RISK_BASED, matches
   implemented rule version, has the exact notice hash and genuine legal, Meta,
   notice, child-exclusion and risk-standard approval references. The recorded
   Meta-restrictions determination must be cleared. Dates must be current and
   before the earlier review/expiry or hard deadline. A config string does not
   demonstrate that the referenced approval actually occurred.
7. The prospective audit binds the server context, order/contact fingerprint,
   policy/version/approval references, evaluation reference and timestamp. Before
   actual transport, the existing signed-webhook-created captured payment record
   must match order/value/currency. The webhook passes its verified capture facts;
   retries use the existing captured DB row. No opening/click/redirect is proof.
8. Anonymous order-scoped withdrawal controls have been successfully retained by
   this browser and their availability acknowledged to the server. This background
   acknowledgement is NOT consent, identity verification or a user question.
   If storage/acknowledgement fails, alternative sharing stays withheld and Razorpay
   still opens. The optional acknowledgement has a 2-second timeout.

The signed context uses a domain-separated HMAC key derived on the server from
its already-required Razorpay merchant secret. No new secret or verification
provider. The secret is never sent/logged/read by tools. Key rotation invalidates
issued contexts and can withhold pending alternative events; billing continues.
A 15-minute context is validated when the prospective order audit is created;
retries revalidate its signature and that original time binding, not a new visit.

## Privacy and withdrawal without an old receipt

A random order-scoped privacy bearer is returned with the existing order response;
only its hash is stored inside the existing prepared JSON audit field. The browser
retains it for accessible Privacy choices. /memory-meta/purchase-choice supports
ONLY readiness or withdrawal, never a grant, new approval, age assertion or policy
edit. Readiness cannot clear a refusal; a compare-and-set prevents a late readiness
write overwriting concurrent withdrawal. Confirmed withdrawal persists blocked /
refused state and stops subsequent matching sharing. Wrong bearers are rejected.
The existing consent endpoint still handles explicit browser-consent choices.
Failures remain visibly pending; no false server-withdrawal confirmation.

Another device or lost browser storage needs the existing privacy/support channel
for rights handling. This is not a pre-purchase verification requirement. Already
accepted/in-flight data cannot be recalled. The prepared BrainoDad-specific section
of PrivacyPolicy.jsx describes permitted hashed contacts, purchase data, Meta uses,
no student identifiers, separate browser tracking and accessible choices. It is
DRAFT text for counsel review, not approved/published by this work. Other product
policy paragraphs and product/WhatsApp behavior are unchanged.

## Capture, delivery and historical protection

Existing signature verification, one-record accounting constraints, CAPI transport,
lease/retry worker, stable payment-derived event ID and deduplication are reused.
Purchase / 99 / INR / memory_masterclass_99 goes ONLY to dataset 1998316064175555.
Alternative decisions never set metaConsentGranted=true or require an old receipt.
Recheck live policy/privacy/source/conflict checks immediately before sending.
Record delivered/retry/failed/skipped and controlled reason codes in existing fields.
A prospective candidate waiting for privacy-control readiness also retries with
no transmission; a late acknowledgement can then release the same stable event.
Permanent refusals/expiry still skip. Temporary CAPI/authorization failures preserve existing retry behavior, without
sending unchecked. Known ineligibility/expiry skips, rather than backfills later.

Only allowed purchaser-derived email/phone matching reaches the existing hasher.
No assessment answers/scores/student IDs, inherited fbc/fbp/external ID/UA/IP or
provider identity substitution. Audit/control tokens are never in CAPI payloads.
Historical SKIPPED_CONSENT rows and old orders without a prospective audit are
not requalified or replayed. Browser Purchase remains absent; failed/abandoned
payments and thank-you visits never create Purchase. Existing GA scope is unchanged;
Meta student exclusions are not a blanket claim about all other analytics.

## Activation blocker — precise, not an unfinished evaluator

Before enabling, counsel/compliance must approve the actual sharing authorization,
current applicable Meta Business Tools/account/dataset restrictions, exact short
notice plus prepared full Privacy Policy, and THIS specific risk standard.
The determination must explicitly address that the dedicated adult-directed flow,
form provenance, conservative conflict checks and +91 contact scope do not verify
18+ age, actual contact ownership or Indian residency. A previously unknown child
using fresh contact details can evade those checks; anonymous request headers can
be forged. No stronger evidence has been invented. If applicable requirements need
stronger age/ownership/jurisdiction evidence than this proposal provides, this is
the activation blocker: keep the mode OFF. Do not create a manual registry or
silently classify those users as verified adults. The software does not decide
whether the proposed scope is legally/platform sufficient.

Approval must cover receipt-free withdrawal/support, retention/access/rights
handling of these audit records and Meta's permitted uses. References must point
to genuine dated determinations; OFFLINE test references are not legal approval.
The Indian commencement timetable alone does not authorize sharing. No current
Meta compatibility conclusion or legal exemption is asserted in this implementation.

## Exact enable/disable procedure — NOT performed

Single alternative-mode switch, default absent/false:

```text
MEMORY_META_ADULT_PURCHASE_ENABLED=false
```

After the approvals above and separate owner release/activation authorization,
configure MEMORY_META_ADULT_PURCHASE_POLICY_JSON with the genuine approved values:

```json
{
  "version": "<approved-policy-version>",
  "ruleVersion": "parents-risk-scope-v1",
  "scope": "IN_ADULT_DIRECTED_PARENTS_RISK_BASED",
  "authorizationSource": "<specific-approved-authorization-and-jurisdiction>",
  "legalApprovalRef": "<dated-legal-determination>",
  "metaTermsReviewRef": "<current-Meta-terms-and-dataset-review>",
  "metaRestrictionsCleared": true,
  "noticeApprovalRef": "<exact-short-and-full-notice-approval/git-revision>",
  "childExclusionApprovalRef": "<specific-child-exclusion-review>",
  "riskScopeApprovalRef": "<acceptance-of-this-risk-standard-and-limitations>",
  "noticeHash": "<SHA256-of-MEMORY_PURCHASE_NOTICE-in-memoryMetaConsent.js>",
  "effectiveAt": "<approved-ISO-time-with-timezone>",
  "expiresAt": "<approved-time-no-later-than-2027-05-13T00:00:00+05:30>",
  "reviewDueAt": "<approved-review-time-before-the-hard-deadline>"
}
```

No populated production JSON or fake approval is shipped. Then set the single
ENABLED switch to true and apply the approved backend runtime config rollout.
Keep existing dedicated CAPI destination/token and retry worker configuration;
never expose their secrets. No further evaluator coding is needed IF this exact
proposed rule/notices are approved. Different/stronger approved requirements need
only their separately reviewed changes; approval is not permission to ignore them.

Disable with ENABLED=false and apply it to running backend processes; each
subsequent attempt rechecks it. Hosting env changes normally require rollout /
restart; this is not an instant remote service and cannot recall an in-flight event.
Valid consent-based reporting and payments continue. The existing emergency
MEMORY_META_PURCHASE_SHARING_BLOCKED=true stops all purchase sharing independently.
Policy version/approval changes invalidate prior alternative audits, never backfill.

Hard stop: May 13, 2027 00:00 IST (May 12 18:30 UTC), or earlier policy review /
expiry. Existing valid consent can continue independently. Database/env dates
cannot extend this version; a compliant successor requires separate review/code.

## Migration, deployment and rollback

Reuse prepared 20261029120000_memory_purchase_authorization_audit: one nullable
purchaseAuthorization JSONB column on existing checkout intents. No additional
schema change, tables, adult registry, accounts, verification scripts or providers.
Prisma validation passes; schema-only generated SQL matches the prepared migration.
NOT applied to any database. No production records or consent history changed.

After separate explicit release approval: recheck exact deployed SHAs/source drift
and both PR diffs; review pending startup migrations. Apply only the approved
migration through the existing process, regenerate Prisma client, deploy the
reviewed backend before frontend with the alternative switch OFF. Smoke-test
schedule/privacy/booking, with no real charge. After separate approved activation,
apply genuine policy metadata + switch and verify only an explicitly authorized
live test. No deployment of a consent-only substitute is proposed to the owner.

Rollback: switch OFF and apply runtime config; use existing global stop if needed;
restore each service's own pinned reviewed commit. Leave the additive nullable
column/audit evidence intact. No payment reversal, event replay or DB drop.
Previously observed production SHAs (not refreshed/changed here): frontend
6e15446706bff98ce494140ee07d951ff72cc0f5; backend
5b825a6f1bbf7ecce2592d45fe0f0d282f9f78da. Keep their distinct source branches.

## Final proof and exact incremental files

| Check | Result |
|---|---|
| Backend six regression suites | 167 passed |
| Frontend unit/privacy/safety | 167 passed |
| Real webhook, production evaluator, CAPI serializer and component offline tests | 59 passed |
| Rendered production-browser tests | 18 passed |
| Existing network parser | 9 passed |
| Full production frontend build | PASS; inherited chunk-size warning |
| Prisma validation and migration SQL comparison | PASS; one nullable column only |

420 focused tests passed; zero final failures. No real provider/payment requests,
production customer data or database integration test. Test policy references
are explicitly OFFLINE. The positive tests import the actual production evaluator,
not a replacement or always-true mock. One shared mocked ledger records ten unique
new captures, ten accounting rows, ten distinct event IDs and ten accepted CAPI
attempts with metaConsentGranted=false and no receipt. Another shared ledger records
ten policy-disabled captures and zero alternative transmissions. Duplicate webhooks
increase neither count. Captures/CAPI responses and request headers are mocked;
this is not actual legal approval or live attribution proof.

Additional cases: refusals/withdrawal and withdrawal-then-regrant; child/student /
restricted inputs; inherited consent on new conflicting Parents contacts; known
assessment-contact conflicts; invalid/expired/mismatched signed context; unavailable
choice storage/readiness; failed payments; actual mocked transport timeout/retry;
pending-policy disable/review/May expiry; order/purchaser binding; historical skips.
Browser checks no unwanted controls, normal payment despite readiness failure,
choice retention/withdrawal, notice, responsive layout, approved schedule and
Spoken English/Vocabulary/German dataset isolation. No WhatsApp workflow changes.

Accepted MOCK log:
`[memory-meta] DELIVERED event=memory_masterclass_99_purchase_pay_new_0 dataset=1998316064175555 value=99 currency=INR source=approved_alternative`
Actual Meta acceptance, match quality and ad attribution are not claimed. Stable
IDs support dedup after uncertain responses, not exactly-once HTTP transport.

PR #6 incremental files:

- client/src/components/memory/MemoryStandaloneCheckout.jsx
- client/src/components/memory/MemoryPurchaserDetails.jsx
- client/src/lib/memoryPurchaseMeasurement.js
- client/src/pages/legal/PrivacyPolicy.jsx
- client/src/lib/memoryPurchaseMeasurement.test.js
- client/tests/memoryFunnelComponents.offline.mjs
- client/tests/memoryRelease.rendered.mjs
- docs/brainodad-meta-funnel-oct28.md

PR #7 incremental files:

- server/services/memoryPurchaseRule.js
- server/services/memoryMetaConsent.js
- server/services/memoryMetaDelivery.js
- server/routes/memoryMasterclassStandaloneCheckout.js
- server/routes/memoryMetaConsent.js
- server/routes/webhookRazorpay.js
- server/__tests__/memoryFunnel.offline.mjs
- server/__tests__/memoryMasterclassCheckout.test.js

**GO for technical review of the implemented proposed rule. Activation remains
NO-GO until the specific legal/Meta/risk/notice approvals and separate owner
release/activation authorization. Both PRs remain drafts; nothing activated.**
