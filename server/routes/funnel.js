// server/routes/funnel.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../db/client.js";
import { normalizeWhatsAppNumber } from "../lib/whatsappNumber.js";
import {
  buildSmartSignupWhatsAppState,
  buildWebinarWhatsAppState,
  cancelPendingLesson1Reminder,
  clearWhatsAppPhoneSuppressionOnExplicitConsent,
  reconcileLesson1SignupReminder,
} from "../lib/whatsappIdentity.js";

const router = express.Router();

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function cleanString(value, maxLength = 200) {
  const cleaned = String(value || "").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function normalizeTrack(track) {
  const value = String(track || "")
    .trim()
    .toUpperCase();
  if (value === "INTERMEDIATE" || value === "ADVANCED") return "INTERMEDIATE";
  return "BEGINNER";
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function setAuthCookie(res, token) {
  res.cookie("fj_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    has_access: !!user.has_access,
    track: user.track || "BEGINNER",
    current_unit: user.current_unit || 1,
    avatar_url: user.avatar_url || null,
    level_check_result: user.level_check_result || null,
    level_check_score: user.level_check_score ?? null,
    webinar_registered: !!user.webinar_registered,
    whatsapp_number: user.whatsapp_number || null,
    current_status: user.current_status || null,
    main_goal: user.main_goal || null,
    practice_commitment: user.practice_commitment || null,
  };
}

router.post("/smart-signup", async (req, res) => {
  try {
    const body = req.body || {};

    const name = cleanString(body.name, 100);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    const levelCheckResult = cleanString(body.level_check_result, 50);
    const rawScore = body.level_check_score;
    const parsedScore =
      rawScore === undefined || rawScore === null || rawScore === ""
        ? null
        : Number(rawScore);

    const track = normalizeTrack(body.track || levelCheckResult);

    const whatsappNumber = cleanString(body.whatsapp_number, 30);
    const whatsappNumberNormalized = normalizeWhatsAppNumber(whatsappNumber);
    const currentStatus = cleanString(body.current_status, 80);
    const mainGoal = cleanString(body.main_goal, 120);
    const practiceCommitment = cleanString(body.practice_commitment, 120);

    if (!name) {
      return res
        .status(400)
        .json({ ok: false, message: "Please enter your name." });
    }

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Please enter your email and password.",
      });
    }

    if (!whatsappNumber) {
      return res.status(400).json({
        ok: false,
        message: "Please enter your WhatsApp number.",
      });
    }

    if (!whatsappNumberNormalized) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_WHATSAPP_NUMBER",
        message: "Please enter a valid WhatsApp number.",
      });
    }

    if (!currentStatus || !mainGoal || !practiceCommitment) {
      return res.status(400).json({
        ok: false,
        message: "Please complete all signup questions.",
      });
    }

    const reserveSeat = body.reserve_seat !== false;
    const whatsappConsent = body.whatsapp_consent === true;

    const consentRecordedAt = new Date();
    const updateData = {
      name,
      track,
      current_unit: 1,
      level_check_result: levelCheckResult,
      level_check_score: Number.isFinite(parsedScore) ? parsedScore : null,
      level_check_completed_at: new Date(),
      whatsapp_number: whatsappNumber,
      whatsapp_number_normalized: whatsappNumberNormalized,
      current_status: currentStatus,
      main_goal: mainGoal,
      practice_commitment: practiceCommitment,
      webinar_registered: reserveSeat,
      webinar_registered_at: reserveSeat ? new Date() : null,
      whatsapp_consent: whatsappConsent,
      whatsapp_consent_at: whatsappConsent ? consentRecordedAt : null,
      whatsapp_consent_source: whatsappConsent ? "try-spoken-english-gym" : null,
      utm_source: cleanString(body.utm_source, 150),
      utm_medium: cleanString(body.utm_medium, 150),
      utm_campaign: cleanString(body.utm_campaign, 200),
      utm_content: cleanString(body.utm_content, 200),
      utm_term: cleanString(body.utm_term, 200),
      source: cleanString(body.source, 150),
      campaign: cleanString(body.campaign, 200),
      adset: cleanString(body.adset, 200),
      ad: cleanString(body.ad, 200),
    };

    const existingUser = await prisma.user.findUnique({ where: { email } });
    let user;
    let createdNewUser = false;

    if (existingUser) {
      const passwordMatches = await bcrypt.compare(
        password,
        existingUser.password,
      );

      if (!passwordMatches) {
        return res.status(409).json({
          ok: false,
          code: "ACCOUNT_EXISTS",
          message:
            "An account already exists with this email. Please use the correct password or login.",
        });
      }

    }

    const hashedPassword = existingUser
      ? null
      : await bcrypt.hash(password, 10);
    const whatsappState = buildSmartSignupWhatsAppState({
      existingUser,
      nextNormalizedNumber: whatsappNumberNormalized,
      consent: whatsappConsent,
      now: consentRecordedAt,
    });

    user = await prisma.$transaction(async (tx) => {
      const savedUser = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              ...updateData,
              ...whatsappState.update,
            },
          })
        : await tx.user.create({
            data: {
              ...updateData,
              ...whatsappState.update,
              email,
              password: hashedPassword,
              plan: "FREE",
              has_access: false,
              tier_level: "free",
              avatar_url: "/avatars/avatar-01.png",
            },
          });

      await clearWhatsAppPhoneSuppressionOnExplicitConsent({
        prisma: tx,
        userId: savedUser.id,
        phoneNumberNormalized: whatsappNumberNormalized,
        consent: whatsappConsent,
        now: consentRecordedAt,
      });

      return savedUser;
    });
    createdNewUser = !existingUser;

    const token = signToken(user);
    setAuthCookie(res, token);

    // ── Automation: schedule or cancel LESSON1_SIGNUP_REMINDER ──────────────
    // Isolated — never blocks signup response.
    try {
      await reconcileLesson1SignupReminder({
        prisma,
        userId: user.id,
        whatsappConsent,
        whatsappNumber,
        whatsappNumberNormalized,
      });
    } catch (automationErr) {
      console.error("LESSON1_SIGNUP_REMINDER automation error:", automationErr);
      // Do not rethrow — signup response must not be blocked.
    }
    // ────────────────────────────────────────────────────────────────────────

    return res.status(createdNewUser ? 201 : 200).json({
      ok: true,
      message: createdNewUser
        ? "Account created and webinar seat reserved."
        : "Account updated and webinar seat reserved.",
      token,
      email: user.email,
      plan: user.plan,
      has_access: !!user.has_access,
      track: user.track || "BEGINNER",
      current_unit: user.current_unit || 1,
      webinar_registered: !!user.webinar_registered,
      whatsapp_consent: whatsappConsent,
      redirect: "/activation",
      user: publicUser(user),
    });
  } catch (err) {
    console.error("Smart signup error:", err);
    return res.status(500).json({
      ok: false,
      message: "Smart signup failed. Please try again.",
    });
  }
});

router.post("/register-webinar", async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Please login to reserve your webinar seat.",
      });
    }

    const body = req.body || {};

    const whatsappNumber = cleanString(body.whatsapp_number, 30);
    const whatsappNumberNormalized = normalizeWhatsAppNumber(whatsappNumber);

    if (whatsappNumber && !whatsappNumberNormalized) {
      return res.status(400).json({
        ok: false,
        code: "INVALID_WHATSAPP_NUMBER",
        message: "Please enter a valid WhatsApp number.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return res.status(404).json({
        ok: false,
        message: "User account was not found.",
      });
    }

    const whatsappState = buildWebinarWhatsAppState({
      existingUser,
      nextNormalizedNumber: whatsappNumberNormalized,
    });

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        webinar_registered: true,
        webinar_registered_at: new Date(),
        whatsapp_number: whatsappNumber,
        whatsapp_number_normalized: whatsappNumberNormalized,
        current_status: cleanString(body.current_status, 80),
        main_goal: cleanString(body.main_goal, 120),
        practice_commitment: cleanString(body.practice_commitment, 120),
        ...whatsappState.update,
      },
    });

    if (whatsappState.identityChanged) {
      // A webinar registration has no consent input, so a new destination
      // cannot receive a replacement reminder. Cancellation is best effort
      // and must never break the registration response.
      try {
        await cancelPendingLesson1Reminder(prisma, userId);
      } catch (automationErr) {
        console.error(
          "LESSON1_SIGNUP_REMINDER webinar identity reconciliation error:",
          automationErr,
        );
      }
    }

    return res.json({
      ok: true,
      message: "Webinar seat reserved.",
      user: publicUser(user),
    });
  } catch (err) {
    console.error("Register webinar error:", err);
    return res.status(500).json({
      ok: false,
      message: "Could not reserve webinar seat.",
    });
  }
});

router.post("/event", async (req, res) => {
  try {
    console.log("[FUNNEL-EVENT]", {
      userId: req.user?.id || null,
      event: req.body?.event || null,
      payload: req.body?.payload || {},
      createdAt: new Date().toISOString(),
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Funnel event error:", err);
    return res.status(500).json({ ok: false });
  }
});

export default router;
