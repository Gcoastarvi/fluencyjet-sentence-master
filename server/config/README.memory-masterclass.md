# Weekly Memory Masterclass settings

Edit **`server/config/memoryMasterclassEvent.js`**, in
`MEMORY_MASTERCLASS_WEEKLY_SETTINGS`:

- `startsAt`: the new date/start time in ISO format, including `+05:30` for IST.
- `endsAt`: the new date/end time, also including `+05:30`.
- `whatsappGroupUrl`: the new `https://chat.whatsapp.com/...` invite link.

Commit and publish the update (or restart the backend for Preview). The event
identifier, readable date, start/end labels, and public event response are derived
from these settings. No environment-variable change is needed.

`GET /api/memory-masterclass/event` exposes only the public event presentation
fields. The offer, checkout description, offer analytics, and thank-you page use
this response. Failed loading shows an explicit retry rather than an old schedule.

Do not change the checkout amount, currency, product key, owner-token checks, or
webhook logic when updating a weekly event. Create-order still obtains its event
directly from server configuration. Old checkout intents and purchases retain
their original event snapshots; updating settings does not rewrite them.

The public thank-you page shows the current weekly event/group, not a historical
order-specific schedule. Avoid changing the active event while buyers are still
registering for the previous one.

WANotifier's score message currently receives only learner name and score. Any
date/time text hardcoded in an external WhatsApp template must be updated there
separately; this release does not change WhatsApp delivery or template variables.

## VSLs and hero image

The default school VSL is `1234364593`; the advanced VSL is `1234364777`.
Existing `VITE_MEMORY_PARENT_VSL_ID` / `VITE_MEMORY_ADVANCED_VSL_ID` overrides
still take precedence and require a frontend rebuild.

Upload the optimized portrait to
`client/public/images/memory-challenge-hero.webp`, then rebuild/publish the
frontend. Until it exists, the landing page hides the missing portrait gracefully.
