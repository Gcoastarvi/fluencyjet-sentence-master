// server/routes/diagnostic.js
import express from "express";
import {
  getDiagnosticQuestions,
  submitDiagnostic,
} from "../controllers/diagnosticController.js";

const router = express.Router();

// Support BOTH routes (avoid mismatch)
router.get("/questions", getDiagnosticQuestions);
router.get("/quiz", getDiagnosticQuestions);

router.post("/submit", submitDiagnostic);

export default router;
