---
name: WhatsApp journey serialization
description: Concurrency rule for milestone transitions and signup reminder reconciliation.
---

All reminder mutations driven by learner milestones and signup/re-consent reconciliation must serialize on the same learner/product transaction-level advisory lock. Before creating a milestone-triggered reminder, check under that lock whether its cancellation milestone already exists; learner actions can be recorded in reverse journey order. The signup reminder becomes ineligible at 10 completed Lesson 1 reorder sentences, even when the lesson total is larger.

**Why:** Cancelling signup at the practice threshold is insufficient if concurrent re-consent can recreate it after cancellation. A production no-send canary also showed that an earlier open or exploration milestone can precede the milestone that normally schedules its now-obsolete reminder. Event-type uniqueness does not prevent either stale creation path.

**How to apply:** Acquire the shared learner/product lock before reading progress or milestones and before cancelling or creating journey reminders. Treat cancellation milestones as creation guards, and keep final send eligibility as an independent second fail-safe.