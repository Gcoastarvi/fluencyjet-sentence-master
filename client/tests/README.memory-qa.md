# Offline Memory conversion QA

On the development branch, with existing dependencies installed:

```sh
node --test client/tests/runMemoryQa.test.mjs
python3 -B client/tests/memoryQaNetwork.test.py
node client/tests/runMemoryQa.mjs
```

The runner never starts the backend or a Replit workflow. It passes an explicit
non-secret child environment, ignores normal Vite config/environment files,
binds Vite to `127.0.0.1:3000`, disables its API proxy, and keeps environment,
cache, home and browser-profile output in temporary scratch.

Linux `unshare`, `setpriv`, user/network namespace permission and `python3` are
required. Complete kernel netlink dumps must prove a different namespace with
genuine loopback and, optionally, only default Linux SIT `sit0` (type 776,
flags 128: DOWN), with no tunnel addresses or routes. Every other interface,
non-loopback address/route (IPv4/IPv6, all tables), unknown route attributes,
malformed/truncated/interrupted dump, or incomplete inspection is rejected.
Inventory uses namespace-local netlink, never host-mounted `/sys/class/net`.

Python configures only loopback inside that namespace, then inventories it again.
`setpriv` removes all capability sets, including bounding/ambient capabilities,
and enables no-new-privileges. These restrictions and the exact post-setup
inventory are verified before Vite imports and again before Chromium launch.
An inability to inspect, configure or drop privileges fails closed. There is no
host-network/non-isolated fallback; no normal workflow/backend should be used.
The namespace isolates Vite, Chromium and descendants from external networking.
A failure exits nonzero and cleans QA scratch and QA-owned child processes.

For concurrent development use a separate worktree. Do not check out/copy `.env`
files, install dependencies, or run normal Vite config. Use independent offline
dependency copies with no symlinks back to source or writable caches in the main
worktree. Run the launcher itself with an explicit sanitized environment, e.g.
`env -i PATH="$PATH" HOME=/tmp/qa-home NODE_ENV=test node client/tests/runMemoryQa.mjs`.
The child allowlist also excludes `NODE_OPTIONS`, loader/preload variables,
credentials and production settings. `HOME` inside QA is fresh temporary scratch.

The browser suite still intercepts API/external page requests before navigation
and stubs Meta/Razorpay. It checks exact successful-open/InitiateCheckout ordering
on result and standalone school/advanced pages, and no dispatch when order
creation fails or open throws. This is mock behavior verification, not proof of
real Meta receipt.

Real receipt QA is separate: owner-approved isolated fixtures, no production DB,
payment keys or messaging services; real BrainoDad-only SDK Lead/InitiateCheckout
and synthetic signed Purchase through a mocked database with a dedicated server
token and Memory test-event code. Never expose that token to frontend code.
