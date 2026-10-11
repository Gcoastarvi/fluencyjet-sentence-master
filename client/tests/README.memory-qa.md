# Offline Memory conversion QA

On the development branch, with existing dependencies installed:

```sh
node --test client/tests/runMemoryQa.test.mjs
node client/tests/runMemoryQa.mjs
```

The runner never starts the backend or a Replit workflow. It passes an explicit
non-secret child environment, ignores normal Vite config/environment files,
binds Vite to `127.0.0.1:3000`, disables its API proxy, and keeps environment,
cache, home and browser-profile output in temporary scratch.

Linux `unshare`, user/network namespace permission and `python3` are required.
The network gate requires a different namespace containing **only** loopback.
Python enables loopback inside that namespace; it never changes the host network.
Vite imports and Chromium launch happen only after the gate succeeds. There is
no non-isolated fallback. A failure exits nonzero and cleans scratch.

The current workspace creates a namespace with `lo` **and `sit0`**, so this
deliberately strict gate refuses to run here. Do not bypass it or use the normal
development workflow instead. A QA host whose fresh namespace contains only
loopback, or a separately reviewed namespace setup removing the extra tunnel
interface, is needed. No host-network or production settings should be changed.

The browser suite still intercepts API/external page requests before navigation
and stubs Meta/Razorpay. It checks exact successful-open/InitiateCheckout ordering
on result and standalone school/advanced pages, and no dispatch when order
creation fails or open throws. This is mock behavior verification, not proof of
real Meta receipt.

Real receipt QA is separate: owner-approved isolated fixtures, no production DB,
payment keys or messaging services; real BrainoDad-only SDK Lead/InitiateCheckout
and synthetic signed Purchase through a mocked database with a dedicated server
token and Memory test-event code. Never expose that token to frontend code.
