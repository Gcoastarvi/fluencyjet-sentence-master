---
name: Sending audit safety
description: Privacy and ordering rules for read-only audits of uncertain WhatsApp reminder attempts.
---

Read-only operator audits must never expose provider-controlled free text, raw provider identifiers, or destination values. Return only deliberately selected structured metadata and presence booleans.

**Why:** Provider error text can contain phone numbers or WhatsApp identifiers even when dedicated raw fields are excluded.

**How to apply:** Treat the response formatter as a data boundary. Do not pass through provider error titles/details or raw payload fields; add adversarial tests with sensitive-looking provider text.

When an audit's age anchor is `processedAt` with `createdAt` as a fallback, page each anchor partition in deterministic timestamp-plus-ID order and merge before applying the result limit.

**Why:** Database null ordering and timestamp ties can otherwise omit older or nondeterministically chosen rows at a page boundary.

**How to apply:** Use the same effective-anchor and ID comparator in query ordering and in the merged response order; fetch at least the requested limit from every disjoint anchor partition.