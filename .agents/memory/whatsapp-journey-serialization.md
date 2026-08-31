---
name: WhatsApp journey serialization
description: Concurrency rule for milestone transitions and signup reminder reconciliation.
---

All reminder mutations driven by learner milestones and signup/re-consent reconciliation must serialize on the same learner/product transaction-level advisory lock. Before creating a milestone-triggered reminder, check under that lock whether its cancellation milestone already exists; learner actions can be recorded in reverse journey order. The signup reminder becomes ineligible at 10 completed Lesson 1 reorder sentences, even when the lesson total is larger.

**Why:** Cancelling signup at the practice threshold is insufficient if concurrent re-consent can recreate it after cancellation. A production no-send canary also showed that an earlier open or exploration milestone can precede the milestone that normally schedules its now-obsolete reminder. Event-type uniqueness does not prevent either stale creation path.

**How to apply:** Acquire the shared learner/product lock before reading progress or milestones and before cancelling or creating journey reminders. Treat cancellation milestones as creation guards, and keep final send eligibility as an independent second fail-safe.

Checkout follow-ups must be created only from a persisted `DELIVERED` webhook
for the exact provider message of an internally `SENT` source event, and must
be idempotent per source automation event, not merely per
learner/product/type.

**Why:** Provider acceptance is not delivery; Meta can later report failure.
A learner can also legitimately start a later checkout journey after an earlier
one is terminal. Global follow-up deduplication would suppress the later
journey, while active-event deduplication alone can duplicate a follow-up after
the first one becomes terminal.

**How to apply:** Persist the status webhook first, verify its provider message
and automation-event linkage, anchor the follow-up to the delivery timestamp,
persist the source identity, and retain source-specific database uniqueness.