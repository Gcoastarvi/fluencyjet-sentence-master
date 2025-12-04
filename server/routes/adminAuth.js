import express from "express";
import prisma from "../db/client.js";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: "Email and password are required",
      });
    }

    if (
      email !== process.env.ADMIN_EMAIL ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({
        ok: false,
        message: "Invalid admin credentials",
      });
    }

    // After verifying email/password & checking isAdmin
    import express from "express";
    import jwt from "jsonwebtoken";

    const router = express.Router();

    router.post("/login", async (req, res) => {
      try {
        const { email, password } = req.body;

        if (!email || !password) {
          return res.status(400).json({
            ok: false,
            message: "Email and password are required",
          });
        }

        // Admin email + password from ENV
        if (
          email !== process.env.ADMIN_EMAIL ||
          password !== process.env.ADMIN_PASSWORD
        ) {
          return res.status(401).json({
            ok: false,
            message: "Invalid admin credentials",
          });
        }

        // Create admin JWT
        const token = jwt.sign(
          {
            email,
            role: "admin",
            isAdmin: true,
          },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        return res.json({
          ok: true,
          token,
          user: {
            email,
            role: "admin",
            isAdmin: true,
          },
        });
      } catch (err) {
        console.error("Admin login error:", err);
        return res.status(500).json({
          ok: false,
          message: "Internal server error",
        });
      }
    });

    export default router;

    return res.json({
      ok: true,
      token,
    });
  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({
      ok: false,
      message: "Internal server error",
    });
  }
});

export default router;
