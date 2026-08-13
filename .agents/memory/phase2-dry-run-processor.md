---
name: Phase 2 DRY_RUN processor
description: Design decisions and constraints for the AutomationEvent dry-run processor endpoint built in Phase 2.
---

# Phase 2 DRY_RUN processor

## What was built
`POST /api/automation/process-due-reminders` — a single-reminder dry-run processor.
Router: `server/routes/automationProcessor.js`. Mounted in `index.js` at `/api/automation`.

## Key rules (must not be changed without explicit approval)

- `AUTOMATION_SECRET` env var is fail-closed: 503 if missing/empty/poison-value before any DB op.
- `dryRun: true` (boolean) is a required body field — string "true", false, absent all → 400.
- Exactly one identifier: email / userId / automationEventId. Multiple → 400. None → 400.
- `sentAt` is NEVER set by this processor. Only `processedAt` and `cancelledAt` are written.
- No batch path exists. No cron. No WhatsApp API. No frontend surface.

## Lookup rule for email/userId (critical)
Step A: resolve user. Step B: `findFirst WHERE userId + eventType + status=PENDING` (partial unique index guarantees ≤1 row). If null → Step C fallback: `findFirst ORDER BY createdAt DESC` for ALREADY_PROCESSED reporting only (no write). Never select an arbitrary historical row when a PENDING one exists.

## Race guard
`updateMany WHERE id=ae.id AND status='PENDING'` — if count=0, another process won; return ALREADY_PROCESSED.

## Log noise (known, harmless)
`[AUTH-DEBUG] Token Verification Failed: jwt malformed` appears for every processor request because the existing global `authMiddleware` runs before the router and tries to parse AUTOMATION_SECRET as a JWT. This sets req.user=null and continues; the processor does not use req.user at all. No fix needed — it's pre-existing middleware behaviour.

**Why:** The processor uses its own Bearer check, completely independent of the JWT auth layer.

## Migration
`server/prisma/migrations/20260813000000_add_dry_run_status/migration.sql` — adds `DRY_RUN` enum value and `processedAt TIMESTAMP(3)` column. Idempotent.

## Production deployment note
AUTOMATION_SECRET must be set as a Railway env var on the `api.fluencyjet.com` backend service only. Never on the frontend (`www.fluencyjet.com`) service. Never prefixed `VITE_`.

## First production test
Do NOT backdate scheduledAt in production. Create a real test signup, wait the full 7 minutes, then call the endpoint. This is the only test that validates actual timing logic.
