import { MEMORY_RECEIPT_PIXEL } from "./memoryReceiptPolicy.mjs";

// A MOCK SDK adapter, never downloaded from Meta. The application creates its
// genuine bootstrap queue; this adapter drains it and records standard events.
export const offlineSdkMock = `
(() => {
  const queue = window.fbq;
  if (!queue || !Array.isArray(queue.queue) || !window.fixtureRecordCall)
    throw new Error("Application SDK queue/diagnostic recorder missing");
  queue.callMethod = (...args) => {
    window.fixtureRecordCall(...args);
    if (args[0] !== "trackSingle" ||
        !["PageView","Lead","InitiateCheckout"].includes(args[2])) return;
    if (args[1] !== "${MEMORY_RECEIPT_PIXEL}") throw new Error("Foreign receipt pixel");
    const params = new URLSearchParams({
      id: args[1], ev: args[2], dl: location.href,
      cd: JSON.stringify(args[3] || {}), eid: args[4]?.eventID || ""
    });
    // Fetch is fulfilled by CDP; kernel isolation prevents all actual egress.
    fetch("https://www.facebook.com/tr/?" + params).then(response => {
      if (!response.ok) throw new Error("Mock receipt rejected");
    }).catch(error => { window.fixtureReceiptError = error.message; });
  };
  for (const args of queue.queue.splice(0)) queue.callMethod(...args);
  window.fixtureSdkReady = true;
})();
`;

function replaceOnce(source, marker, replacement) {
  if (source.split(marker).length !== 2) {
    throw new Error("Fixture shape changed; refusing guessed receipt instrumentation");
  }
  return source.replace(marker, replacement);
}

// Assemble in scratch, not application source or the hardened offline runner.
// Keep all original browser tests/assertions; opt-in affects ONLY extra cases.
export function buildReceiptBrowserSuite(source, cases, policyUrl, fixtureUrl, rootUrl) {
  source = replaceOnce(source, 'from "../../server/config/memoryMasterclassEvent.js"',
    `from "${new URL("server/config/memoryMasterclassEvent.js", rootUrl)}"`);
  source = replaceOnce(source, 'from "./memoryNavigationDiagnostics.mjs"',
    `from "${new URL("client/tests/memoryNavigationDiagnostics.mjs", rootUrl)}"`);
  source = replaceOnce(source, "  shortViewport = false,\n",
    "  shortViewport = false, receiptMock = false,\n");
  source = replaceOnce(source, "  const checkoutRequests = [];\n",
    "  const checkoutRequests = [];\n  const receiptRequests = [];\n");
  source = replaceOnce(source, "    const url = new URL(request.url);\n", `
    const url = new URL(request.url);
    if (receiptMock && url.hostname === "connect.facebook.net") {
      const decision = inspectBrowserMetaRequest(request.url, request.method);
      if (decision.path !== "/en_US/fbevents.js") throw new Error("Unexpected mock SDK request");
      return fulfill(requestId, offlineSdkMock, "application/javascript");
    }
    if (receiptMock && ["facebook.com","www.facebook.com"].includes(url.hostname)) {
      receiptRequests.push(inspectBrowserMetaRequest(request.url, request.method, request.postData || ""));
      return send("Fetch.fulfillRequest", {requestId, responseCode:200,
        responseHeaders:[{name:"Content-Type",value:"application/json"},
          {name:"Access-Control-Allow-Origin",value:"*"}],
        body:Buffer.from("{}").toString("base64")});
    }
`);
  source = replaceOnce(source, "    persist();\n    // Headless Chromium", `
    \${receiptMock ? "window.fjMetaConsent = true; window.fixtureRecordCall = window.fbq; delete window.fbq; delete window._fbq;" : ""}
    persist();
    // Headless Chromium`);
  source = replaceOnce(source, "    leadRequests, apiRequests, checkoutRequests, diagnostics,",
    "    leadRequests, apiRequests, checkoutRequests, receiptRequests, diagnostics,");
  return `import {assertReceiptSandbox} from ${JSON.stringify(new URL("client/tests/memoryReceiptSandbox.mjs", rootUrl).href)};
await assertReceiptSandbox({scratch:process.env.MEMORY_RECEIPT_QA_SCRATCH,
  parent:process.env.MEMORY_RECEIPT_QA_PARENT_NAMESPACE,path:process.env.PATH});
import {inspectBrowserMetaRequest} from ${JSON.stringify(policyUrl)};
import {offlineSdkMock} from ${JSON.stringify(fixtureUrl)};
${source}\n${cases}`;
}
