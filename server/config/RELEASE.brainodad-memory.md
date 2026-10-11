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
- No new Prisma migrations were added by the Pixel implementation.

Fresh GitHub main is a verified source reference, not proof that both Railway
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
| Frontend Pixel/document boundary/VSL config/score band | 45/45 |
| Backend Memory/FJ purchase/WhatsApp regressions | 213/213, 16 suites |
| Offline policy/safety/navigation diagnostics | 76/76 |
| Network parser | 9/9 |
| Browser conversion and receipt fixtures | 40/40 |
| Signed capture using actual CAPI helper and mocked HTTP/Prisma | 10/10 |

No real Meta/Razorpay/WhatsApp requests or database connections were made.
Mock acceptance is not proof of real Meta event receipt. No app backend or
normal workflow was started. No push or deployment was performed.

## Production configuration — owner supplies privately

On the Railway BACKEND service/environment:

- `MEMORY_META_CAPI_ACCESS_TOKEN`: dedicated BrainoDad token, server-only.
- `MEMORY_META_PIXEL_ID`: optional; omit or set exactly `1998316064175555`.
  Any other value disables Memory CAPI.
- `MEMORY_META_TEST_EVENT_CODE`: absent/unset in production.
- `RAZORPAY_WEBHOOK_SECRET`: existing dedicated webhook signing secret.
  Verify privately against the provider's configured webhook; do not replace
  it or assume the API key secret is the webhook secret.
- Preserve existing FJ, Razorpay, database, session and WANotifier variables.
- `MEMORY_META_QA_ENABLED` is not consulted by this app and is not a CAPI gate.

No access token belongs in a `VITE_*` variable, browser storage, source,
screenshots, logs or chat. The browser Pixel ID is public and code-owned.

## Open release gates

1. Advertising consent: browser tracking is allowed unless
   `window.fjMetaConsent === false`; there is no in-app consent UI calling
   `setMetaConsent`. WhatsApp consent is not advertising consent. Purchase
   delivery does not have a persisted advertising-consent decision. Confirm
   the applicable policy and approved implementation before public release.
2. HTML fallback: Express injects a route-specific noscript PageView without
   checking browser consent. The separate frontend service may instead serve
   the static placeholder. Verify actual serving and consent behavior.
3. `client/.env.local` is tracked but was never materialized/read for QA.
   The frontend service rooted at `client` must not be assumed protected by
   the root Docker ignore rules. Privately audit, exclude/untrack as approved,
   and configure necessary public build settings in Railway before shipping.
4. Assessment checkout takes the first raw X-Forwarded-For value for matching
   context. Confirm the actual proxy chain sanitizes it; otherwise do not
   assert that the IP represents the genuine client. Standalone uses req.ip.
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
back to FJ. Email/phone and visitor external ID are hashed. fbp/fbc and stored
checkout IP/user-agent are unhashed. Provider email/contact are matching
inputs; purchaser identity snapshots remain separately persisted. No scores
or student identity are included as custom event parameters.

Delivery is accepted only for successful HTTP plus events_received >= 1.
Token text is redacted from Memory error output. Inspect safe failure/skip
logs and MemoryMasterclassPurchase.metaDelivered=false to identify losses.
There is no automatic retry/backfill; replaying payments will NOT recover
failed CAPI. A crash between purchase persistence and send can also lose the
conversion. Do not weaken payment idempotency to fix this. Decide whether
this monitored best-effort behavior satisfies the required reliability gate.

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
   keep campaigns paused until both run the intended revision.
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
   procedure; verify one purchase/CAPI attempt. Check FJ dataset for absence
   of Memory conversions and check its normal events separately.
7. Do not enable ads until all four standard events and separation are
   verified. Never fire Purchase from a thank-you page or fabricate events
   by manually calling fbq instead of application instrumentation.
