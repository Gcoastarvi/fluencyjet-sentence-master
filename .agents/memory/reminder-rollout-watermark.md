---
name: Reminder rollout watermark
description: The safety boundary used when manually rolling out Lesson 1 WhatsApp reminders.
---

# Reminder rollout watermark

Manual reminder rollout discovery uses a fixed, canonical UTC environment watermark against `AutomationEvent.createdAt`, not `scheduledAt` or the current processing time.

**Why:** Events created before a rollout must remain historical backlog even if their scheduled time arrives after the rollout begins. A mutable or send-time boundary could silently expand the audience.

**How to apply:** Keep rollout watermarks explicit, strictly validated, and immutable for an invocation. Any future rollout worker should preserve `createdAt >= watermark` semantics, deterministic ordering, and a bounded candidate set.