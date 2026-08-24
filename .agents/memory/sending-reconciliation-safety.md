---
name: Sending reconciliation safety
description: Safety constraints for manually resolving uncertain WhatsApp reminder sends.
---

# Sending reconciliation safety

Manual reconciliation of an uncertain WhatsApp reminder is a narrow terminal
transition, never a retry mechanism: retain only evidence-gated `SENDING →
SENT` and explicitly quarantined `SENDING → CANCELLED` paths.

**Why:** A provider outcome can remain uncertain after a timeout. Returning an
event to pending or dispatching during reconciliation risks duplicate messages;
terminalizing without exact linked provider evidence risks falsely reporting
delivery.

**How to apply:** Require linked evidence that matches both the event and its
persisted provider ID before marking sent; keep a durable idempotency/action
journal in the same lock-owning transaction as the state change. Any competing
live sender must re-read the event after it obtains that destination lock and
exit before provider dispatch if reconciliation made the event terminal.