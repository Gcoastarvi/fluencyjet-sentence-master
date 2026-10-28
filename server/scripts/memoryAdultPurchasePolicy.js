// Operator-only local CLI. No public approval endpoint. Never run automatically.
import { readFile } from "node:fs/promises";
import prisma from "../db/client.js";
import { activeAdultPurchasePolicy, recordVerifiedAdultEvidence, ADULT_PURCHASE_NOTICE, ADULT_PURCHASE_NOTICE_HASH,
  ADULT_PURCHASE_NOTICE_VERSION } from "../services/memoryAdultPurchasePolicy.js";
const [action, arg] = process.argv.slice(2);
try {
  if (action === "notice") {
    console.log(JSON.stringify({ notice: ADULT_PURCHASE_NOTICE, noticeVersion: ADULT_PURCHASE_NOTICE_VERSION,
      noticeHash: ADULT_PURCHASE_NOTICE_HASH }, null, 2));
  } else if (action === "register-adult-evidence") {
    const input = JSON.parse(await readFile(arg, "utf8"));
    const result = await recordVerifiedAdultEvidence(input);
    console.log(`Adult evidence registered: ${result.id}`);
  } else if (action === "revoke-adult-evidence") {
    const row = await prisma.memoryAdultPurchaseAuthorization.findUnique({ where: { id: arg } });
    if (row?.decision !== "ADULT_EVIDENCE_VERIFIED") throw new Error("Verified evidence record required");
    await prisma.memoryAdultPurchaseAuthorization.update({ where: { id: arg }, data: { blockedAt: new Date(), blockReason: "EVIDENCE_REVOKED" } });
    console.log("Adult evidence revoked");
  } else if (action === "register") {
    const input = JSON.parse(await readFile(arg, "utf8"));
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(input.id || "")) throw new Error("Invalid policy version ID");
    const data = Object.fromEntries(["id", "scope", "legalApprovalRef", "metaApprovalRef", "adultEvidenceApprovalRef",
      "authorizationSource", "noticeVersion", "noticeHash", "restrictionsCleared"].map(k => [k, input[k]]));
    for (const k of ["effectiveAt", "expiresAt", "reviewDueAt"]) {
      data[k] = new Date(input[k]);
      if (!input[k] || !Number.isFinite(+data[k])) throw new Error(`Missing approved ${k}`);
    }
    // Immutable version: create, never upsert or silently replace approvals.
    await prisma.memoryAdultPurchasePolicy.create({ data: { ...data, enabled: false } });
    console.log(`Registered disabled policy ${data.id}`);
  } else if (["enable", "disable"].includes(action)) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(arg || "")) throw new Error("Invalid policy version ID");
    if (action === "enable") {
      const row = await prisma.memoryAdultPurchasePolicy.findUnique({ where: { id: arg } });
      const candidate = row && await activeAdultPurchasePolicy({
        db: { memoryAdultPurchasePolicy: { findUnique: async () => ({ ...row, enabled: true }) } },
      });
      if (!candidate || candidate.id !== arg) throw new Error("Approval, notice, scope, dates or environment gates are incomplete");
    }
    await prisma.memoryAdultPurchasePolicy.update({ where: { id: arg }, data: { enabled: action === "enable" } });
    console.log(`Policy ${arg} ${action === "enable" ? "enabled" : "disabled"}`);
  } else throw new Error("Use notice | register <approved.json> | enable <id> | disable <id> | register-adult-evidence <verified.json> | revoke-adult-evidence <id>");
} catch (error) {
  console.error(`Policy command failed: ${error.message}`); process.exitCode = 1;
} finally { await prisma.$disconnect(); }
