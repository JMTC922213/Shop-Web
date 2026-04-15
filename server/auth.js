const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");

function sanitizeShortText(value) {
  return String(value ?? "").replace(/[<>]/g, "").trim();
}

function getValidationErrorResponse(req, res) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return false;
  }
  res.status(400).json({
    error: "Validation failed",
    details: result.array().map((e) => ({ field: e.path, message: e.msg })),
  });
  return true;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "Strict",
  path: "/",
  maxAge: 2 * 24 * 60 * 60 * 1000, // 2 days
};

async function parseSession(database, req, res, next) {
  req.user = null;
  req.sessionData = null;
  const token = req.cookies && req.cookies.auth_token;
  if (!token) return next();

  try {
    const session = await database.get(
      "SELECT s.token, s.userid, s.csrf_token, s.expires_at, u.email, u.name, u.is_admin " +
      "FROM sessions s JOIN users u ON s.userid = u.userid WHERE s.token = ?",
      [token]
    );

    if (!session || new Date(session.expires_at) <= new Date()) {
      if (session) {
        await database.run("DELETE FROM sessions WHERE token = ?", [token]);
      }
      res.clearCookie("auth_token", COOKIE_OPTIONS);
      return next();
    }

    req.user = {
      userid: session.userid,
      email: session.email,
      name: session.name,
      is_admin: session.is_admin,
    };
    req.sessionData = {
      token: session.token,
      csrf_token: session.csrf_token,
      expires_at: session.expires_at,
    };
  } catch (_err) {
    // If session lookup fails, treat as unauthenticated
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    return res.redirect(302, "/login.html");
  }
  if (!req.user.is_admin) {
    if (req.path.startsWith("/api/")) {
      return res.status(403).json({ error: "Admin access required" });
    }
    return res.redirect(302, "/");
  }
  next();
}

function registerAuthRoutes(app, database) {
  // Get current user info + CSRF token
  app.get("/api/auth/me", (req, res) => {
    if (!req.user) {
      return res.json({ user: null, csrf_token: null });
    }
    res.json({
      user: { name: req.user.name, email: req.user.email, is_admin: req.user.is_admin },
      csrf_token: req.sessionData.csrf_token,
    });
  });

  // Login
  app.post("/api/auth/login", [
    body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ], async (req, res) => {
    if (getValidationErrorResponse(req, res)) return;

    try {
      const user = await database.get("SELECT * FROM users WHERE email = ?", [req.body.email]);
      if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Rotate session (prevent session fixation)
      const oldToken = req.cookies && req.cookies.auth_token;
      if (oldToken) {
        await database.run("DELETE FROM sessions WHERE token = ?", [oldToken]);
      }

      const token = crypto.randomBytes(32).toString("hex");
      const csrfToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

      await database.run(
        "INSERT INTO sessions (token, userid, csrf_token, expires_at) VALUES (?, ?, ?, ?)",
        [token, user.userid, csrfToken, expiresAt]
      );

      res.cookie("auth_token", token, COOKIE_OPTIONS);
      res.json({
        user: { name: user.name, email: user.email, is_admin: user.is_admin },
        redirect: user.is_admin ? "/admin-categories.html" : "/",
      });
    } catch (_err) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Register
  app.post("/api/auth/register", [
    body("name").trim().notEmpty().withMessage("Name is required")
      .isLength({ max: 100 }).withMessage("Name must be <= 100 characters")
      .customSanitizer(sanitizeShortText),
    body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) throw new Error("Passwords do not match");
      return true;
    }),
  ], async (req, res) => {
    if (getValidationErrorResponse(req, res)) return;

    try {
      const existing = await database.get("SELECT userid FROM users WHERE email = ?", [req.body.email]);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const hash = await bcrypt.hash(req.body.password, 10);
      await database.run(
        "INSERT INTO users (email, name, password, is_admin) VALUES (?, ?, ?, 0)",
        [req.body.email, req.body.name, hash]
      );
      res.status(201).json({ message: "Registration successful. Please log in." });
    } catch (_err) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req, res) => {
    const token = req.cookies && req.cookies.auth_token;
    if (token) {
      await database.run("DELETE FROM sessions WHERE token = ?", [token]).catch(() => {});
    }
    res.clearCookie("auth_token", COOKIE_OPTIONS);
    res.json({ message: "Logged out" });
  });

  // Change password
  app.post("/api/auth/change-password", [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters"),
    body("confirmNewPassword").custom((value, { req }) => {
      if (value !== req.body.newPassword) throw new Error("Passwords do not match");
      return true;
    }),
  ], async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (getValidationErrorResponse(req, res)) return;

    try {
      const user = await database.get("SELECT * FROM users WHERE userid = ?", [req.user.userid]);
      if (!(await bcrypt.compare(req.body.currentPassword, user.password))) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const hash = await bcrypt.hash(req.body.newPassword, 10);
      await database.run("UPDATE users SET password = ? WHERE userid = ?", [hash, req.user.userid]);

      // Invalidate all sessions for this user
      await database.run("DELETE FROM sessions WHERE userid = ?", [req.user.userid]);
      res.clearCookie("auth_token", COOKIE_OPTIONS);
      res.json({ message: "Password changed. Please log in again." });
    } catch (_err) {
      res.status(500).json({ error: "Failed to change password" });
    }
  });
}

module.exports = { parseSession, requireAdmin, registerAuthRoutes };
