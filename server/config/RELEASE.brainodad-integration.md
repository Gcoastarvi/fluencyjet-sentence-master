# BrainoDad non-deploy integration preparation — 12 October 2026

Nothing in this document authorizes a production connection, settings change,
push, deployment, customer message, payment or actual Meta transmission.
Keep the campaign paused until all four real standard events are verified.

## Source and rollback anchor

- Independent worktree: /tmp/brainodad-release-ready-20261012
- Local preparation branch: release/brainodad-ready-20261012
- Recovered release: e6e478ebd886108d1b5dcf7acf926ce1fc4eb4e4
- Freshly fetched main / pristine source rollback:
  9a5e48d245f058a2635c0bd465b52ed5d838f0be
- This Git SHA is not proof of the currently deployed Railway revision.
  Owner must record both actual service revisions before any approved deployment.
- Three newer main commits are the WANotifier contact/nurture updates.
  Their four files are byte-identical to fetched main in this integration.
  There are no overlapping paths or merge conflicts with the recovered release.
- Integration merge parent 1 is the recovered release, parent 2 is fetched main.
  Do NOT use a blind `git revert -m 1` as production rollback: that would undo
  the main-side WA changes while keeping the Memory feature. An explicitly
  reviewed mainline-2 revert of this integration merge, or coordinated redeploy
  of the recorded source SHA, is the source rollback direction. Never force-push.

## Offline checks actually executed on this integration

No package install, environment-file loading, real database, backend workflow,
SDK transmission or external payment/message was used. Dependencies were copied
offline into this worktree, with env files and self-links excluded. The existing
runner used a separate verified loopback namespace, zero capabilities,
no-new-privileges, empty envDir, no API proxy and mocked outbound integrations.
The only runner change adds main's existing wanotifierMemoryContact unit suite.

| Check | Result |
| --- | --- |
| Frontend unit tests | 50/50 |
| Offline safety/policy/navigation diagnostics | 76/76 |
| Python network parser | 9/9 |
| Backend regression including current WA contact sync | 255/255, 19 suites |
| Browser conversion/consent/document ownership | 42/42 |
| Signed capture, actual CAPI helper, mocked HTTP/Prisma | 10/10 |
| Prisma validate | Passed; no database connected |
| Client production build | Passed; scratch output, sanitized environment |

Command:

    env -i PATH="$PATH" HOME=/tmp/brainodad-ready-qa-parent NODE_ENV=test \
      node client/tests/runMemoryReceiptQa.mjs --mock \
      --acknowledge-synthetic-consent --regression

## Migration gate — NOT passed

Integration contains 35 migrations. The original 34 SQL files are byte-identical
to fetched main; the only addition is:

    server/prisma/migrations/20261011150000_memory_meta_consent_delivery/migration.sql

New SQL SHA-256:

    25594c79b1a9543d9a1f0cb917de9768ebc8f5c2f9166cefe89ea5cdb8120eb5

Owner reports production PostgreSQL 17, 34 successful migrations, latest
20261010120000_add_memory_standalone_checkout, all three Memory tables present,
and absence of the new consent table/columns/migration. These facts agree with
the expected names. Production ledger checksums have NOT been supplied/verified.
The private Windows schema/CSV exports have NOT been supplied. No real database
rehearsal is claimed. Prior empty-database history replay fails on missing
AutomationType foundations; do not edit history or fabricate applied status.

Minimum next input: owner-reviewed sanitized schema-only SQL, ledger CSV with
id/name/checksum/started_at/finished_at/rolled_back_at/applied_steps_count but no
logs, PostgreSQL version, collection time, deployed backend SHA and sanitization
notes. No customer rows, credentials or application tokens.

Prefer the complete sanitized application schema. A restricted export must
retain the three Memory tables, their dependent tables/types/sequences,
constraints/indexes/triggers/functions and SQL-only features. Stop rather than
drop dependencies to make restoration succeed.

Under separate permission, restore into disposable local PostgreSQL (prefer 17),
seed synthetic historical data, apply the exact new SQL and test default-deny
preservation, consent/revocation, concurrent leases, fencing, bounded retries,
crash recovery, terminal states and signed webhook replay. A faithful copy of
the real administrative ledger can then test full migrate deploy and a second
no-op. Only the new migration may be pending; stop on drift/failure/unknown rows.

## Owner-controlled deployment sequence — future approval required

1. Clear the real-DB rehearsal, compare exported ledger checksums, approve adult
   advertising consent copy/retention/privacy, and recheck fresh main before
   integration. Record actual backend/frontend rollback revisions and confirm a
   usable DB backup. Source rollback does not roll back schema; retain additions.
2. Privately verify frontend Railway BUILD variables after deletion of tracked
   client/.env.local: VITE_API_BASE_URL (including the cross-origin Memory consent
   API), VITE_MEMORY_SESSION_PERSISTENCE_ENABLED=true for saved assessments, and
   existing VITE_API_URL/BACKEND_URL/English/Vocabulary settings as applicable.
   Backend CORS/cookie routing and www/non-www host paths must match production.
   The sanitized offline build does not prove those deployment variables exist.
3. Privately verify backend dedicated MEMORY_META_CAPI_ACCESS_TOKEN,
   MEMORY_META_DELIVERY_ENABLED=true, NODE_ENV=production,
   MEMORY_META_PIXEL_ID absent or exactly 1998316064175555, and
   MEMORY_META_TEST_EVENT_CODE absent. Preserve FJ/Razorpay/session/DB/WA values.
   MEMORY_META_QA_ENABLED is not an app gate. Never put tokens in VITE variables.
4. Both Railway services auto-deploy main. Do not assume one push gives backend-
   first ordering. Before authorizing a main push, owner must arrange an explicit
   frontend deployment hold/sequence with the available Railway controls; if that
   cannot be arranged, stop for review. No Railway controls were changed here.
5. Separately approve backend deployment. Docker starts with
   node scripts/deploy.js && node index.js; migrate deploy runs before listening.
   Confirm migration completion, API health, consent endpoint and worker-enabled
   configuration. The worker starts from server/index.js, polls every 30 seconds,
   and requires the true flag. Multiple replicas use atomic leases.
6. Separately approve frontend build/deployment of the same integrated revision.
   Verify hero/VSL/schedule, assessment/standalone checkout and consent allow/
   decline/withdraw. Confirm each document initializes only its owning pixel and
   memory noscript does not emit FJ events. Confirm existing FJ baseline.
7. With explicit owner approval for messages/payment/Meta, use adult owner details:
   allow measurement -> Memory PageView; genuinely saved lead -> Lead; successful
   checkout.open after server-created order -> InitiateCheckout; pay INR 99 ->
   signed captured webhook -> consented persisted Purchase -> BrainoDad CAPI.
   School and advanced standalone paths must preserve their track selection.
   Record standard event names/destination/unique IDs and replay suppression.
   Do not fire browser Purchase on thank-you. Ads stay paused until verified.

Production test_event_code is intentionally forbidden: it disables Memory CAPI.
A real production owner Purchase is checked in live dataset activity and delivery
evidence, not by adding a Test Events code. If a server Test Events receipt is
required, use an explicitly approved nonproduction test-code run, mocked business
systems and private QA token; never change production NODE_ENV to bypass the gate.

## Remaining risks

No actual four-event receipt or migration execution was done in this preparation.
Retries are bounded (6 attempts / 24 hours) and stable event IDs deduplicate
at-least-once transmission; this is not an unlimited recovery queue.
FJ Graph v19 remains unchanged and expired; its migration is a separate owner-
approved change, not a silent part of this Memory release.
The existing proxy trust configuration is preserved; Memory omits unverified
client IP rather than trusting more headers for matching.
Consent is default-deny, separate from WhatsApp, adult opt-in, verified with the
server, and withdrawable. Declined users may still save/book but are not tracked.
Existing env Git history was not inspected: owner must privately audit it; env
deletion/ignore rules do not erase old blobs or prove their contents were safe.
