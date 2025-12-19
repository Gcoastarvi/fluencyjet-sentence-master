// server/routes/diagnostic.js
import express from "express";
import {
  getDiagnosticQuiz,
  submitDiagnostic,
} from "../controllers/diagnosticController.js";

const router = express.Router();

router.get("/quiz", getDiagnosticQuiz);
// Optional alias (so both URLs work)
router.get("/questions", getDiagnosticQuiz);

router.post("/submit", submitDiagnostic);

export default router;
