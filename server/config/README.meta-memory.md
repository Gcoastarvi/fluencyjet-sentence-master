# BrainoDad Memory / FluencyJet Meta separation

This is development work. Do not publish, merge to main, change production secrets,
or alter ads/campaigns until the owner approves a release.

## Destinations and browser behavior

- FJ Sentence Master: `1246171816816642`.
- BrainoDad Memory: `1998316064175555`.
- Memory routes: `/memory-challenge`, `/memory-masterclass`, `/memory-retest`,
  `/memory-products`, and their children. Nested retests are included.
- Other routes (including vocabulary, spoken English, German, account and
  practice routes) remain FJ. Prefix lookalikes are not memory routes.
- Client and server route registries are tested together. Register any future
  memory route in both registries before release.
- Only `trackSingle` / `trackSingleCustom` is used. Route guards reject delayed
  callbacks from the other funnel. SPA visits initialize each Pixel once.
- Meta PageViews deduplicate repeated effects. Returning after visiting another
  route is a new view. Memory query-only changes are not new views. Existing GA4
  calls and English query-string PageViews are retained.
- Automatic event discovery is disabled for BOTH Pixels. This is necessary to
  prevent automatic events bypassing the route guard after SPA navigation.
  Application-defined FJ events/payloads/cooldowns are preserved. Review any
  externally configured automatic/Event Setup Tool events before deployment:
  their behavior is outside this repository and must not be assumed unchanged.
- Production Express renders a route-specific no-script PageView fallback.
  A different static host must implement that fallback or leave the placeholder
  empty; never restore a global FJ fallback on memory URLs.

## Memory conversion semantics

- Existing custom `memory_*` events continue on the memory Pixel.
- Standard Lead occurs only after `/api/memory/session/lead` confirms
  `lead.saved`. Merely starting/completing/scoring/viewing the assessment is not
  a Lead. IDs are opaque SHA-256 assessment identifiers, never raw owner tokens.
- Standard InitiateCheckout occurs only after a valid server order and successful
  Razorpay `open()` call. Opening/cancelling registration or failed orders/open
  calls are NOT conversions. The fixed current value is ₹99/INR.
- Conversion IDs/local storage suppress repeat Lead and same-order checkout
  events across callbacks/tabs/reloads when storage is available. In-memory
  guards still work if storage is blocked. Clearing storage can allow repeats.
- No thank-you page fires browser Purchase. A URL/reference is not proof of
  payment. Current Purchase is server-only after verified capture.
- Future verified browser Purchase must use the SAME ID as CAPI:
  `memory_masterclass_99_purchase_<razorpay payment id>`. Both dispatchers support
  event IDs; do not add browser Purchase without a server-verified receipt.

## Dedicated server configuration (no credentials stored in this repo)

Configure the approved development/staging backend's secret store first:

- `MEMORY_META_CAPI_ACCESS_TOKEN`: token authorized for BrainoDad's dataset.
- `MEMORY_META_PIXEL_ID`: optional; if set it MUST be `1998316064175555`.
- `MEMORY_META_TEST_EVENT_CODE`: optional Meta Test Events code for memory only.

No values were added/changed as part of this implementation. Keep the existing
`META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_TEST_EVENT_CODE` unchanged for
English/vocabulary. A missing token or wrong memory ID disables memory CAPI with
an explicit reason; it never falls back to FJ. Verified purchases still persist.
Future server-derived `memory_*` product keys use the same fail-closed boundary.
Remove the MEMORY test code from the approved production configuration only when
the owner authorizes going live; do not reuse the English test code for memory.

CAPI keeps signature verification, stored order/amount/currency/product checks,
purchase idempotency, snapshots and existing attribution unchanged. Email/phone/
external IDs are hashed; Meta click/browser IDs remain unhashed as required.
Purchaser data/tokens are excluded from memory browser event parameters.
Access tokens are server-only, never VITE-prefixed or sent in public config.

## Privacy and consent

WhatsApp consent is NOT advertising consent. No new consent is invented.
Existing GA4 behavior remains. A consent manager can call `setMetaConsent(false)`
to revoke/suppress Meta and `setMetaConsent(true)` to grant; the app does not add
a new consent banner. Review the site's advertising consent/privacy requirements
before an approved production release. Consent opt-out cannot retroactively
erase prior transmissions; no-script behavior also needs review with any CMP.

## Safe validation before release

Automated browser tests replace fbq, intercept ALL external requests and mock
orders. Backend tests mock Meta HTTP/Razorpay/database or use pure fixtures.
They do not send real ad events, WhatsApp messages or charges.

Localhost/Replit Preview does NOT load the real Meta SDK by default. For a
deliberate manual Meta Test Events session only:

1. Open the Preview WEBSITE itself in a separate tab. Attach DevTools to that
   page, not the Replit editor/shell. Ensure the URL is the app origin.
2. Open the matching dataset in Meta Events Manager → Test Events. Use its
   browser testing workflow with the Preview URL. Traffic/domain restrictions,
   ad blockers and consent settings may prevent receipt.
3. To opt in on that Preview tab, run
   `sessionStorage.setItem("fj_meta_qa_opt_in", "true"); location.reload();`
   This enables actual SDK traffic; use only a deliberate Test Events session.
4. School/advanced VSL pages should show memory PageView/offer engagement ONLY.
   A successful test lead save should show one Lead. Use an isolated test
   database and mocked/test-mode delivery, not production leads.
5. Registration opening/cancelling should not show InitiateCheckout. A valid
   Razorpay test-mode order/open should show one, value 99/INR. A thank-you load
   should show PageView only, never Purchase.
6. Navigate WITHIN the SPA to vocabulary/spoken English/German, then back to
   memory. Events must switch destination, not broadcast to both. A plain
   refresh does not verify SPA behavior.
7. In the approved test backend, configure the dedicated MEMORY token/test code.
   Deliver a signed Razorpay test-mode capture for its stored order. Check
   Purchase, value 99/INR, correct event ID, and correct BrainoDad dataset.
   Replay the webhook: no second purchase/CAPI call. Test missing credentials:
   purchase persists, CAPI reports skipped, FJ receives nothing.
8. Check FJ Test Events separately: existing vocabulary/spoken English events
   stay on FJ with existing values; memory events must be absent.
9. Stop Preview SDK traffic with
   `sessionStorage.removeItem("fj_meta_qa_opt_in"); location.reload();`

Tests prove code routing, not access-token authorization, Event Manager receipt,
external automatic rules or production settings. Those require owner-approved
manual checks. This branch must NOT be published just to perform these checks.

Known pre-existing limitation: failed/skipped CAPI has no automatic retry here;
duplicate captures return before resending. Do not replay historical purchases
or relax payment idempotency to work around this.
