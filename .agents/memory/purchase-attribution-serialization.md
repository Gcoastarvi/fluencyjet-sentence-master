---
name: Purchase attribution serialization
description: Fail-closed correlation and concurrency rules for payment-link purchases versus WhatsApp reminders.
---

# Purchase attribution serialization

An authenticated checkout intent is immutable correlation evidence and may attribute at most one exact payment. A later distinct payment must still be persisted as unmatched rather than mislabeled as a duplicate or allowed to reuse the consumed intent.

**Why:** Payment-link webhook traffic has no trustworthy account identifier of its own. Conflating an intent uniqueness conflict with webhook replay can both guess identity and lose a legitimate payment audit.

**How to apply:** Require exact product, normalized identity, and bounded timing with exactly one unconsumed intent. Serialize checkout creation, purchase side effects, and final provider eligibility on the canonical destination lock; re-read entitlement after acquiring it.