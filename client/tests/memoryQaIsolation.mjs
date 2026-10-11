// Pure fail-closed policy, separate from the kernel inventory and process launcher.
const refuse = message => { throw new Error(`Refusing QA: ${message}`); };
const loopback = (value, family) => family === 2
  ? typeof value === "string" && /^127(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value) &&
    value.split(".").every(n => Number(n) <= 255)
  : family === 10 && value === "::1";

export function assertNetworkIsolation(parent, state, { configured = false } = {}) {
  if (!/^net:\[\d+\]$/.test(parent) || !/^net:\[\d+\]$/.test(state?.namespace) ||
      parent === state.namespace || state.complete !== true ||
      !["links", "addresses", "routes"].every(k => Array.isArray(state[k]))) {
    refuse("different namespace and complete kernel inventory required");
  }
  if (state.links.length < 1 || state.links.length > 2) refuse("unexpected interface count");
  const indices = new Set();
  const names = new Set();
  for (const link of state.links) {
    if (!Number.isInteger(link.index) || link.index <= 0 || indices.has(link.index) ||
        names.has(link.name) || !Number.isInteger(link.flags) || link.flags < 0 ||
        link.master !== 0 || link.linked !== 0) refuse("malformed/connected interface");
    indices.add(link.index); names.add(link.name);
    if (link.name === "lo") {
      if (link.hardware !== 772 || !(link.flags & 8) ||
          (configured && !(link.flags & 1))) refuse("genuine active loopback required");
    } else if (link.name !== "sit0" || link.hardware !== 776 || link.flags !== 128) {
      refuse("only default DOWN SIT sit0 is permitted besides loopback");
    }
  }
  const lo = state.links.find(link => link.name === "lo");
  if (!lo) refuse("missing loopback");
  for (const address of state.addresses) {
    if (address.index !== lo.index || ![2, 10].includes(address.family) ||
        address.prefix !== (address.family === 2 ? 8 : 128) || address.scope !== 254 ||
        !Array.isArray(address.values) || !address.values.length ||
        !address.values.every(value => loopback(value, address.family))) refuse("non-loopback/malformed address");
  }
  if (configured && !state.addresses.some(a => a.family === 2 && a.values.includes("127.0.0.1"))) {
    refuse("loopback not configured");
  }
  for (const route of state.routes) {
    if (route.index !== lo.index || ![2, 10].includes(route.family) ||
        !Number.isInteger(route.prefix) || route.prefix < (route.family === 2 ? 8 : 128) ||
        route.prefix > (route.family === 2 ? 32 : 128) ||
        !loopback(route.destination, route.family) ||
        (route.preferredSource !== null && !loopback(route.preferredSource, route.family)) ||
        route.sourcePrefix !== 0 || route.tos !== 0 || route.flags !== 0 ||
        ![254, 255].includes(route.table) || route.protocol !== 2 ||
        ![253, 254].includes(route.scope) || ![1, 2, 3].includes(route.type) ||
        !Array.isArray(route.attributeTypes) ||
        !route.attributeTypes.every(k => [1, 4, 6, 7, 12, 15, 20].includes(k))) {
      refuse("non-loopback, routed tunnel, or unknown route");
    }
  }
}

export function assertSealed(status) {
  for (const name of ["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"]) {
    if (!new RegExp(`^${name}:\\s+0+$`, "m").test(status)) refuse(`capabilities remain: ${name}`);
  }
  if (!/^NoNewPrivs:\s+1$/m.test(status)) refuse("no-new-privileges required");
}

export async function verifiedStart({ parent, expected, inspect, status, start }) {
  assertSealed(await status());
  const current = await inspect();
  assertNetworkIsolation(parent, current, { configured: true });
  if (JSON.stringify(current) !== JSON.stringify(expected)) refuse("post-setup network changed");
  return start();
}
