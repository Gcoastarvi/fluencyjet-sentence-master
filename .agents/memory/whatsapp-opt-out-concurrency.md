---
name: WhatsApp opt-out concurrency
description: A race condition to consider when an inbound STOP and outbound reminder processing overlap.
---

# WhatsApp opt-out concurrency

Outbound safety gates that use ordinary reads can only observe committed opt-out
state. An inbound STOP transaction may have created suppression and updated
users but not committed when a live reminder claims a PENDING event; the final
gate can still see the prior state and dispatch before that STOP commits.

**Why:** Pending-only cancellation correctly preserves uncertain SENDING
provider attempts, but it also means a STOP that loses this timing race cannot
cancel the newly claimed event.

**How to apply:** When a stronger guarantee is required, serialize inbound STOP
mutations and live reminder claim/final eligibility by canonical destination
with a database-backed per-phone lock, then add a concurrency integration test.

Real concurrency coverage must use a dedicated test database connection, require
that connection explicitly, reject a target that matches production before any
write, and clean only run-scoped test records afterward.

**Why:** Git branches isolate code but not database state; mocked transactions
cannot demonstrate PostgreSQL advisory-lock blocking or prove production data
was protected.

**How to apply:** Connect the integration client directly from the explicit test
database setting, use production settings only for a sanitized pre-write target
comparison, and never treat production configuration as a connection fallback.