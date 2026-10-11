# BrainoDad complete conversion release — preparation only

Prepared on 11 October 2026. Do not enable paid campaigns until standard
PageView, Lead, InitiateCheckout and Purchase are received and verified.
This is not a browser-only release; production Memory CAPI must be configured.

## Source and preparation

- Freshly fetched GitHub main: `240f75ca9eff3d78689b0680ed566205986ccac4`.
- Integrated implementation: `a2ff002083c73d1c79c8b4bd987fdbf0122179a7`.
- Release branch: `release/brainodad-pixel-complete`.
- Independent worktree: `/tmp/brainodad-pixel-release`.
- The active WhatsApp worktree was not changed. Its unmerged development
  changes are not silently included in this release.
- Additive migration: server/prisma/migrations/20261011150000_memory_meta_consent_delivery/migration.sql.
  Historical rows default to no consent and no delivery queue; no payment backfill.

The main reference above was fetched during earlier preparation, not this update.
It is not proof of the latest remote HEAD or that both Railway
services currently run that commit. Before approving deployment, inspect each
service's deployed commit, build/start settings, domain and API routing.

## Validation performed

All processes used sanitized environments; environment files were excluded.
Independent dependency copies were made offline without install scripts.
Production build and regression checks used a separate loopback-only network
namespace, verified before launch, with capabilities dropped and
no-new-privileges. The existing hardened browser runner was not weakened.

| Check | Result |
| --- | --- |
| Client production build | Passed |
| Frontend Pixel/document boundary/consent/VSL config/score band | 50/50 |
| Backend Memory/FJ purchase/consent/retry/WhatsApp regressions | 248/248, 18 suites |
| Offline policy/safety/navigation diagnostics | 76/76 |
| Network parser | 9/9 |
| Browser conversion, consent and receipt fixtures | 42/42 |
| Signed capture using actual CAPI helper and mocked HTTP/Prisma | 10/10 |
| Prisma schema validation | Passed, no database connection |

Exact full regression command from this worktree:

    env -i PATH="$PATH" HOME=/tmp/brainodad-release-qa-parent NODE_ENV=test \
      node client/tests/runMemoryReceiptQa.mjs --mock \
      --acknowledge-synthetic-consent --regression

The runner checks isolation before every phase, builds into scratch using an
empty envDir, and removes its owned frontend/Chromium processes and scratch.
Migration SQL has not been applied to PostgreSQL in this preparation.
Dry-run the additive migration against an isolated, restored staging database
before production; schema validation is not migration execution.

No real Meta/Razorpay/WhatsApp requests or database connections were made.
Mock acceptance is not proof of real Meta event receipt. No app backend or
normal workflow was started. No push or deployment was performed.

## Production configuration — owner supplies privately

On the Railway BACKEND service/environment:

- `MEMORY_META_CAPI_ACCESS_TOKEN`: dedicated BrainoDad token, server-only.
- `MEMORY_META_DELIVERY_ENABLED=true`: enables the Memory-only polling worker
  in the backend process. No new Railway service/cron is required. Configure
  this before the reliability-first launch; the initial webhook attempt alone
  is not durable recovery. Multiple replicas use atomic per-purchase leases.
- `MEMORY_META_PIXEL_ID`: optional; omit or set exactly `1998316064175555`.
  Any other value disables Memory CAPI.
- `MEMORY_META_TEST_EVENT_CODE`: absent/unset in production. A nonempty value
  with NODE_ENV=production now disables Memory delivery, rather than silently
  sending production orders as test events.
- `RAZORPAY_WEBHOOK_SECRET`: existing dedicated webhook signing secret.
  Verify privately against the provider's configured webhook; do not replace
  it or assume the API key secret is the webhook secret.
- Preserve existing FJ, Razorpay, database, session and WANotifier variables.
- `MEMORY_META_QA_ENABLED` is not consulted by this app and is not a CAPI gate.

No access token belongs in a `VITE_*` variable, browser storage, source,
screenshots, logs or chat. The browser Pixel ID is public and code-owned.

## Open release gates

1. Memory advertising consent is now optional, separate from WhatsApp, and
   default-deny before SDK loading or the first PageView. An adult affirmation,
   server acknowledgement and current policy are required. Saved grants are
   reverified. Consent-denied visitors can still save their lead and pay.
   Review the purpose-specific copy, 30-day choice duration and privacy policy
   before launch. Adult purchaser data must be the adult's own details, never
   student contact details. This does not change FJ consent/account settings.
2. Memory noscript pixels are now absent; FJ fallback is unchanged. Verify the
   actual frontend HTML and absence of external tags or Event Setup Tool rules
   that bypass consent or route/document ownership.
3. `client/.env.local` was untracked without reading or materializing it.
   Root Git/Docker ignores now cover nested env files. This does NOT erase Git
   history or prove old values were safe. Privately audit/rotate if necessary.
   Confirm the frontend Railway build variables: VITE_API_BASE_URL/API_URL/
   BACKEND_URL as applicable, VITE_MEMORY_SESSION_PERSISTENCE_ENABLED, and
   existing English/Vocabulary payment settings. Do not assume root Docker
   ignores alone protect the frontend service rooted at client.
4. Memory checkout no longer stores or sends an unverified IP. CAPI IP is
   omitted even for an old fixture/intent. UA and matching identifiers are
   stored for advertising only after consent. Existing global/FJ trust-proxy
   behavior was not changed; separately review the actual proxy chain. Do not
   enable broad proxy trust merely to improve Meta matching.
5. Confirm both services' production revision and actual build/start commands.
   Backend Docker startup runs Prisma migrate deploy; npm start alone does
   not. Check pending production migrations privately before deployment.
6. Confirm Razorpay's configured backend webhook URL, payment.captured
   subscription, enabled state and matching signing secret. Source route is
   POST /api/webhooks/razorpay; production dashboard state is unverified.

## Purchase behavior and remaining reliability limits

Signed captured Memory orders are checked against persisted server-created
intents, product, event, track and fixed 9900 paise INR. Payment/order/intent
and webhook identifiers provide persistent duplicate prevention. Purchase
event IDs are payment-based; webhook replay returns without another CAPI send.

BrainoDad uses v26.0 exclusively; missing dedicated credentials never fall
back to FJ. Consented adult purchaser email/phone and visitor external ID are
hashed. fbp/fbc and checkout UA are unhashed; IP is omitted. Razorpay provider
email/contact stay separate for audit, not CAPI identity fallback. No student
names, scores or assessment answers are sent. No matching-data copies were
added to the consent table; payment/attribution retention still needs the
owner's approved policy and is not silently changed by this release.

Delivery is accepted only for successful HTTP plus events_received >= 1.
Token text is redacted from Memory error output. Inspect metaDeliveryStatus,
metaAttempts and metaLastErrorCode; metaDelivered=false alone includes old
unqueued/consent-denied records and is NOT evidence of a delivery failure.

Consent receipts are random bearer capabilities stored only in the browser;
the server stores their hashes, adult affirmation, purpose/version/source,
time, expiry and revision. The session/order snapshot is server-validated,
then copied to the verified purchase. Every send rechecks the current record
and revision. Revocation/expiry denies pending sends; regrant does not revive
old orders. Withdrawal is immediate in the browser; if server saving fails
the UI explains that pending server delivery may continue and requires retry.
Already in-flight/accepted Meta requests cannot be recalled by withdrawal.

The purchase itself is the durable Memory-only delivery ledger. Stable event
ID and original signed capture/receipt time survive retries. Atomic claims
use a random 60-second fenced lease; expired leases recover crashes. Memory
HTTP has a 15-second deadline and rejects redirects. Up to six attempts use
1m/5m/15m/1h/4h backoff plus small jitter within 24 hours of the event.
Transient transport/429/5xx failures retry; permanent failures or exhaustion
are terminal and visible. Missing token disables sends without English fallback.
Historical purchases have NULL delivery state and are never automatically
backfilled. Payment webhook replay still cannot create another purchase/send.
Delivery is at-least-once with Meta event-ID deduplication, not a claim of
exactly-once network delivery.

For an explicitly approved operational check, use read-only status counts
filtered to productKey=memory_masterclass_99 and non-NULL metaDeliveryStatus;
review FAILED/EXPIRED and stale SENDING rows privately. Repair credentials/
transport before any separately approved, bounded redrive. Keep the original
event ID/time and require current consent; never mark delivered by hand,
delete purchases or bypass webhook idempotency. No public replay/send control
or broad backlog recovery endpoint was introduced.

FJ v19 remains unchanged and requires a separate safe compatibility migration.
Do not claim existing FJ server receipt is verified by this release.

## Approval and deployment sequence

1. Resolve open gates and privately configure dedicated production token.
   A Railway variable change can itself deploy; coordinate it with the owner,
   never change live configuration during preparation.
2. Record both services' current deployed revisions and migration status.
   Preserve a rollback Git reference and each Railway deployment.
3. Re-fetch main immediately before approval. If it advanced, integrate and
   revalidate relevant changes; never force-push or overwrite concurrent work.
4. Obtain explicit final push/deployment approval. Push the reviewed release
   commit to main once, non-force. Both services auto-deploy independently;
   keep campaigns paused until both run the intended revision. Coordinate
   service rollout so the migrated, new backend is healthy before the new
   frontend is exposed; two automatic deployments are not atomic.
5. Confirm frontend rebuilt, deep links work, API requests reach the intended
   backend and the deployed backend has the dedicated Memory configuration.
6. Rollback uses recorded Railway deployments or a reviewed Git revert. Git
   rollback cannot reverse applied database migrations. No rollback command
   is authorized during preparation.

## Real Meta verification — separate explicit approval required

1. Use an approved consenting owner QA browser/data, not customer/student
   data. A fresh document on a Memory route must register only BrainoDad;
   vocabulary/English/German must register only FJ. Verify links, refresh,
   back/forward and no external tag initializes the wrong Pixel.
2. In BrainoDad Test Events, open the exact approved Memory URL from the test
   browser session. Preview requires fj_meta_qa_opt_in=true in that tab and
   consent independently. Browser events do not use the CAPI test code.
3. With all APIs/Razorpay/WhatsApp mocked in the approved browser fixture,
   verify actual standard Lead after saved success and InitiateCheckout after
   successful checkout.open. Fail/cancel/open-throws must not create events.
   Today's offline fixture cannot send real SDK traffic; authorize only a
   narrowly reviewed manual real-SDK adapter, not a general QA framework.
4. In the separate isolated CAPI Lab, use the actual helper or equivalent
   verified envelope, dedicated token, QA test code, fresh event time and
   unique ID to send one explicitly approved standard Purchase, 99 INR, to
   BrainoDad v26. Use consenting owner matching data supplied privately.
   No live database, Razorpay or WhatsApp is necessary for envelope receipt.
   Test Events is not guaranteed to exclude events from all measurement.
5. After deployment approval, a full end-to-end test requires its own explicit
   owner-only authorization: a real production-mode INR 99 charge, owner
   registration/assessment data and possible WhatsApp messages/reminders.
   Provider fees/refund effects are possible; do not promise a fee-free test.
   Keep production test_event_code absent. Verify Events Manager production
   event activity and the recorded purchase/metaDelivered status. A Test
   Events display for the live server is not guaranteed without a test code.
6. Replay only that authorized test webhook through the supported provider
   procedure; verify one purchase and no replay-triggered CAPI attempt. Check FJ dataset for absence
   of Memory conversions and check its normal events separately.
7. Do not enable ads until all four standard events and separation are
   verified. Never fire Purchase from a thank-you page or fabricate events
   by manually calling fbq instead of application instrumentation.
