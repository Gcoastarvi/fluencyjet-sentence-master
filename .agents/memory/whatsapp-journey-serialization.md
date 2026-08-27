---
name: WhatsApp journey serialization
description: Concurrency rule for milestone transitions and signup reminder reconciliation.
---

All reminder mutations driven by learner milestones and signup/re-consent reconciliation must serialize on the same learner/product transaction-level advisory lock. The signup reminder becomes ineligible at 10 completed Lesson 1 reorder sentences, even when the lesson total is larger.

**Why:** Cancelling signup at the practice threshold is insufficient if concurrent re-consent can recreate it after cancellation. Event-type uniqueness does not protect against a signup event coexisting with a later watch event.

**How to apply:** Acquire the shared learner/product lock before reading progress or milestones and before cancelling or creating journey reminders. Keep final send eligibility independently checking the authoritative 10-sentence threshold.