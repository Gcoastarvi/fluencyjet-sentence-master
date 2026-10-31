import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

import prisma from "../db/client.js";

import {
  issueMemoryRetestAdminInvitation,
} from "../services/memoryRetestAdminInvitation.js";

const PRODUCTION_ORIGINS = new Set([
  "https://www.fluencyjet.com",
  "https://fluencyjet.com",
]);

const VALID_SCHOOL_TRACKS = new Set([
  "school_foundation",
  "school_advanced",
]);

const KNOWN_DENIALS = new Set([
  "ADMIN_NOT_AUTHORIZED",
  "PURCHASE_ID_REQUIRED",
  "PURCHASE_NOT_FOUND",
  "PURCHASE_NOT_CAPTURED",
  "PURCHASE_INVALID",
  "CHECKOUT_INTENT_NOT_FOUND",
  "CHECKOUT_INTENT_MISMATCH",
  "TRACK_MISMATCH",
  "TRACK_ASSIGNMENT_REQUIRED",
  "TRACK_ASSIGNMENT_INVALID",
  "TRACK_ASSIGNMENT_CONFLICT",
  "TRACK_ALREADY_LOCKED",
  "SCHOOL_TRACK_REQUIRED",
  "TRACK_SELECTION_MISMATCH",
  "TRACK_ASSIGNMENT_NOT_ALLOWED",
  "INVALID_SCHOOL_TRACK",
  "MASTERCLASS_NOT_FINISHED",
  "EVENT_CONFIGURATION_INVALID",
  "FORM_B_ALREADY_COMPLETED",
  "ASSESSMENT_NOT_FOUND",
  "NOT_ELIGIBLE",
]);

const INVITATION_BASE =
  "https://www.fluencyjet.com/memory-retest#token=";

function trustedOrigin(origin) {
  if (!origin) {
    // Bearer authentication is mandatory even without Origin.
    // This permits trusted non-browser administrative clients.
    return true;
  }

  if (PRODUCTION_ORIGINS.has(origin)) {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  if (
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?$/.test(
      origin,
    )
  ) {
    return true;
  }

  const preview = process.env.REPLIT_DEV_DOMAIN;

  return Boolean(
    preview && origin === `https://${preview}`,
  );
}

function denialStatus(reason) {
  if (reason === "ADMIN_NOT_AUTHORIZED") {
    return 403;
  }

  if (reason === "PURCHASE_NOT_FOUND") {
    return 404;
  }

  if (
    reason === "PURCHASE_ID_REQUIRED" ||
    reason === "INVALID_SCHOOL_TRACK" ||
    reason === "SCHOOL_TRACK_REQUIRED"
  ) {
    return 400;
  }

  return 409;
}

/*
 * Sensitive administrator-only endpoint.
 *
 * - Never trusts a browser-supplied admin ID.
 * - Never accepts authentication from a cookie.
 * - Never trusts an email-based administrator bypass.
 * - Requires an explicitly configured strong JWT secret.
 * - The internal service checks isAdmin against the database.
 * - No WhatsApp or other automatic delivery.
 */
export function createMemoryRetestAdminRouter({
  prismaClient = prisma,
  invitationIssuer = issueMemoryRetestAdminInvitation,
  jwtSecretProvider = () => process.env.JWT_SECRET,
} = {}) {
  const router = express.Router();

  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });

  const invitationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      ok: false,
      code: "ADMIN_INVITATION_RATE_LIMITED",
    },
  });


  /*
   * Read-only operator lookup for captured Memory Masterclass
   * purchases. Search terms are sent in a POST body rather than
   * URL parameters to avoid exposing email/phone in URL logs.
   *
   * The browser's admin token is not proof of DB authorization:
   * look up isAdmin freshly for every search.
   */
  const purchaseSearchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      ok: false,
      code: "ADMIN_PURCHASE_SEARCH_RATE_LIMITED",
    },
  });

  router.post(
    "/purchases/search",
    purchaseSearchLimiter,
    async (req, res) => {
      if (!trustedOrigin(req.get("origin"))) {
        return res.status(403).json({
          ok: false,
          code: "ADMIN_PURCHASE_SEARCH_ORIGIN_DENIED",
        });
      }

      const secret = jwtSecretProvider();

      if (
        typeof secret !== "string" ||
        secret.length < 32 ||
        secret === "dev-secret" ||
        secret === "fluencyjet_secret_2025"
      ) {
        return res.status(503).json({
          ok: false,
          code: "ADMIN_INVITATION_AUTH_NOT_CONFIGURED",
        });
      }

      const authorization =
        req.get("authorization") || "";

      const bearer = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(
        authorization,
      );

      if (!bearer) {
        return res.status(401).json({
          ok: false,
          code: "ADMIN_AUTH_REQUIRED",
        });
      }

      let claims;

      try {
        claims = jwt.verify(bearer[1], secret, {
          algorithms: ["HS256"],
        });
      } catch {
        return res.status(401).json({
          ok: false,
          code: "ADMIN_AUTH_INVALID",
        });
      }

      if (
        !claims ||
        !Number.isSafeInteger(claims.id) ||
        claims.id <= 0 ||
        claims.isAdmin !== true ||
        claims.role !== "admin"
      ) {
        return res.status(403).json({
          ok: false,
          code: "ADMIN_NOT_AUTHORIZED",
        });
      }

      const search = req.body?.search;

      if (
        typeof search !== "string" ||
        search.trim().length < 3 ||
        search.trim().length > 100
      ) {
        return res.status(400).json({
          ok: false,
          code: "PURCHASE_SEARCH_INVALID",
        });
      }

      const term = search.trim();

      try {
        // The database is authoritative even if the token
        // contains valid-looking administrator claims.
        const admin = await prismaClient.user.findUnique({
          where: { id: claims.id },
          select: {
            id: true,
            isAdmin: true,
          },
        });

        if (
          !admin ||
          admin.id !== claims.id ||
          admin.isAdmin !== true
        ) {
          return res.status(403).json({
            ok: false,
            code: "ADMIN_NOT_AUTHORIZED",
          });
        }

        const purchases =
          await prismaClient.memoryMasterclassPurchase.findMany({
            where: {
              status: "captured",
              productKey: "memory_masterclass_99",
              amount: 9900,
              currency: "INR",
              checkoutSource: {
                in: ["standalone_vsl", "assessment"],
              },
              OR: [
                { id: term },
                {
                  purchaserEmail: {
                    equals: term,
                    mode: "insensitive",
                  },
                },
                {
                  purchaserPhone: {
                    contains: term,
                  },
                },
                {
                  purchaserName: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                {
                  customerEmail: {
                    equals: term,
                    mode: "insensitive",
                  },
                },
                {
                  customerContact: {
                    contains: term,
                  },
                },
              ],
            },
            select: {
              id: true,
              checkoutSource: true,
              trackId: true,
              purchaserName: true,
              purchaserEmail: true,
              purchaserPhone: true,
              customerEmail: true,
              customerContact: true,
              createdAt: true,
              checkoutIntent: {
                select: {
                  eventKey: true,
                  eventStartsAt: true,
                  eventEndsAt: true,
                  trackId: true,
                },
              },
              retestTrackAssignment: {
                select: {
                  trackId: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 10,
          });

        // Explicit output allowlist: no Razorpay IDs,
        // payment identifiers, tokens or Meta data.
        return res.json({
          ok: true,
          purchases: purchases.map(purchase => ({
            purchaseId: purchase.id,
            purchaserName: purchase.purchaserName ?? null,
            purchaserEmail:
              purchase.purchaserEmail ??
              purchase.customerEmail ??
              null,
            purchaserPhone:
              purchase.purchaserPhone ??
              purchase.customerContact ??
              null,
            checkoutSource: purchase.checkoutSource,
            originalTrackId: purchase.trackId,
            assignedTrackId:
              purchase.retestTrackAssignment?.trackId ??
              null,
            eventKey:
              purchase.checkoutIntent?.eventKey ??
              null,
            eventStartsAt:
              purchase.checkoutIntent?.eventStartsAt ??
              null,
            eventEndsAt:
              purchase.checkoutIntent?.eventEndsAt ??
              null,
            purchasedAt: purchase.createdAt,
          })),
        });
      } catch (error) {
        // Do not log customer identity or submitted search text.
        console.error(
          "Memory purchase lookup failed:",
          error?.code || error?.name || "UNKNOWN_ERROR",
        );

        return res.status(500).json({
          ok: false,
          code: "ADMIN_PURCHASE_SEARCH_FAILED",
        });
      }
    },
  );

  router.post(
    "/invitations",
    invitationLimiter,
    async (req, res) => {
      if (!trustedOrigin(req.get("origin"))) {
        return res.status(403).json({
          ok: false,
          code: "ADMIN_INVITATION_ORIGIN_DENIED",
        });
      }

      const secret = jwtSecretProvider();

      if (
        typeof secret !== "string" ||
        secret.length < 32 ||
        secret === "dev-secret" ||
        secret === "fluencyjet_secret_2025"
      ) {
        return res.status(503).json({
          ok: false,
          code: "ADMIN_INVITATION_AUTH_NOT_CONFIGURED",
        });
      }

      const authorization =
        req.get("authorization") || "";

      const bearer = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(
        authorization,
      );

      if (!bearer) {
        return res.status(401).json({
          ok: false,
          code: "ADMIN_AUTH_REQUIRED",
        });
      }

      let claims;

      try {
        claims = jwt.verify(bearer[1], secret, {
          algorithms: ["HS256"],
        });
      } catch {
        return res.status(401).json({
          ok: false,
          code: "ADMIN_AUTH_INVALID",
        });
      }

      if (
        !claims ||
        !Number.isSafeInteger(claims.id) ||
        claims.id <= 0 ||
        claims.isAdmin !== true ||
        claims.role !== "admin"
      ) {
        return res.status(403).json({
          ok: false,
          code: "ADMIN_NOT_AUTHORIZED",
        });
      }

      const purchaseId = req.body?.purchaseId;

      const schoolTrackId =
        req.body?.schoolTrackId === undefined
          ? null
          : req.body.schoolTrackId;

      if (
        typeof purchaseId !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(purchaseId)
      ) {
        return res.status(400).json({
          ok: false,
          code: "PURCHASE_ID_INVALID",
        });
      }

      if (
        schoolTrackId !== null &&
        !VALID_SCHOOL_TRACKS.has(schoolTrackId)
      ) {
        return res.status(400).json({
          ok: false,
          code: "INVALID_SCHOOL_TRACK",
        });
      }

      try {
        const result = await invitationIssuer(
          {
            trustedAdminId: claims.id,
            trustedPurchaseId: purchaseId,
            schoolTrackId,
          },
          {
            prisma: prismaClient,
          },
        );

        if (!result?.issued) {
          const reason = KNOWN_DENIALS.has(result?.reason)
            ? result.reason
            : "INVITATION_DENIED";

          return res.status(denialStatus(reason)).json({
            ok: false,
            code: reason,
          });
        }

        const expiresAt = new Date(
          result.linkExpiresAt,
        );

        if (
          result.purchaseId !== purchaseId ||
          !/^[a-f0-9]{64}$/.test(result.linkToken) ||
          typeof result.grantId !== "string" ||
          !result.grantId ||
          ![
            "school_foundation",
            "school_advanced",
            "advanced",
          ].includes(result.trackId) ||
          !Number.isFinite(expiresAt.getTime()) ||
          expiresAt <= new Date()
        ) {
          throw new Error(
            "Invalid secure invitation service result",
          );
        }

        return res.status(201).json({
          ok: true,
          purchaseId,
          trackId: result.trackId,
          invitationUrl:
            INVITATION_BASE + result.linkToken,
          linkExpiresAt: expiresAt.toISOString(),
          revokedCount: result.revokedCount,
        });
      } catch (error) {
        // Never log raw invitation tokens or purchaser details.
        console.error(
          "Administrator retest invitation failed:",
          error?.code || error?.name || "UNKNOWN_ERROR",
        );

        return res.status(500).json({
          ok: false,
          code: "ADMIN_INVITATION_FAILED",
        });
      }
    },
  );

  return router;
}

export default createMemoryRetestAdminRouter();
