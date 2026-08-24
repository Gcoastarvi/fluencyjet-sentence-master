---
name: Sending monitor partial indexes
description: Preserve the SQL-only partial index used for monitor fallback age ranges.
---

The SENDING age fallback (`processedAt IS NULL`, measured from `createdAt`) relies
on a partial PostgreSQL index whose predicate is exactly `processedAt IS NULL`.
Keep it as raw migration SQL rather than replacing it with a full Prisma schema
index.

**Why:** A full `(eventType, status, createdAt)` index can lose to the
processed-time index for fallback rows, while Prisma schema indexes cannot
express the required partial predicate.

**How to apply:** When changing schema-driven migrations or the monitor fallback
query, preserve the SQL migration and its predicate catalog regression check;
the query must retain `processedAt IS NULL` with its created-time range.