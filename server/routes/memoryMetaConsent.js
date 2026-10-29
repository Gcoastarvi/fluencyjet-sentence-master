import express from "express";
import rateLimit from "express-rate-limit";
import { recordMemoryConsent, memoryConsentSnapshot, updateMemoryPurchaseChoice } from "../services/memoryMetaConsent.js";
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
router.post("/purchase-choice",async(req,res)=>{
  res.set("Cache-Control","no-store");
  try { res.json(await updateMemoryPurchaseChoice(req.body || {})); }
  catch { res.status(503).json({ok:false,code:"PURCHASE_CHOICE_UNAVAILABLE"}); }
});
export default router;
