import { adultPurchasePolicyPresentation, createAdultPurchaseAuthorization, withdrawAdultPurchaseAuthorization } from "../services/memoryAdultPurchasePolicy.js";
import { validatePurchaserDetails } from "./memoryMasterclassCheckout.js";
import express from "express";
import rateLimit from "express-rate-limit";
import { recordMemoryConsent, memoryConsentSnapshot } from "../services/memoryMetaConsent.js";
const router = express.Router();
router.use(rateLimit({ windowMs: 60000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));
router.post("/consent", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const decision = await recordMemoryConsent(req.body || {});
    res.json({ ok: true, ...decision });
  } catch (error) {
    const invalid = error.message.startsWith("CONSENT_");
    res.status(invalid ? 400 : 503).json({ ok: false, code: invalid ? error.message : "CONSENT_UNAVAILABLE" });
  }
});
router.post("/consent/status", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const snapshot = await memoryConsentSnapshot(req.body?.receipt);
    res.json({ ok: true, granted: snapshot.metaConsentGranted });
  } catch {
    res.status(503).json({ ok: false, granted: false });
  }
});
router.get("/purchase-policy", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, ...await adultPurchasePolicyPresentation() });
});
router.post("/purchase-authorization", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const purchaser = validatePurchaserDetails(req.body || {});
  if (purchaser.error) return res.status(400).json({ ok: false, code: "PURCHASER_INVALID" });
  try {
    const result = await createAdultPurchaseAuthorization(req.body || {}, purchaser, { gpc: req.headers["sec-gpc"] === "1" });
    res.json({ ok: true, ...result });
  } catch { res.status(503).json({ ok: false, eligible: false, code: "PURCHASE_AUTHORIZATION_UNAVAILABLE" }); }
});
router.post("/purchase-authorization/withdraw", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try { res.json({ ok: true, ...await withdrawAdultPurchaseAuthorization(req.body?.token) }); }
  catch { res.status(503).json({ ok: false, code: "PURCHASE_WITHDRAWAL_UNAVAILABLE" }); }
});
export default router;

