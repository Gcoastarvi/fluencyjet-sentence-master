---
name: Rollout send gates
description: Mandatory kill-switch composition for manual production WhatsApp reminder rollout.
---

# Rollout send gates

Manual Lesson 1 WhatsApp rollout may send only when both the global `WHATSAPP_LIVE_SEND_ENABLED` kill switch and the separate `WHATSAPP_ROLLOUT_WORKER_ENABLED` gate are enabled.

**Why:** The rollout worker is an additional production entry point, not an exception to the global emergency stop. Replacing the global switch with a rollout-specific gate would let a manual rollout dispatch while the system-wide kill switch was off.

**How to apply:** Preserve both checks before rollout discovery and pass their conjunction into shared live-send processing so a future refactor cannot bypass the global gate. Keep authenticated preview/dry-run independent of both send gates and strictly non-mutating.