import express from "express";
import {
  getDiagnosticQuiz,
  submitDiagnostic,
} from "../controllers/diagnosticController.js";

const router = express.Router();

router.get("/quiz", getDiagnosticQuiz);
router.get("/questions", getDiagnosticQuiz); // alias
router.post("/submit", submitDiagnostic);

export default router;
