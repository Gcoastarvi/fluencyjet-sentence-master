import express from "express";
import {
  getDiagnosticQuestions,
  submitDiagnostic,
} from "../controllers/diagnosticController.js";

const router = express.Router();

router.get("/quiz", getDiagnosticQuestions);
router.post("/submit", submitDiagnostic);

export default router;
