const crypto = require("node:crypto");

function validateCsrf(req, res, next) {
  // Only check state-changing methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Exempt routes that don't use session-based CSRF
  const exempt = ["/api/auth/login", "/api/auth/register", "/api/webhook/stripe"];
  if (exempt.includes(req.path)) {
    return next();
  }

  // If no session, skip CSRF (auth middleware will handle unauthenticated requests)
  if (!req.sessionData) {
    return next();
  }

  const csrfFromRequest = req.headers["x-csrf-token"] || (req.body && req.body._csrf);

  if (!csrfFromRequest) {
    return res.status(403).json({ error: "CSRF validation failed" });
  }

  const expected = Buffer.from(req.sessionData.csrf_token, "utf8");
  const received = Buffer.from(String(csrfFromRequest), "utf8");

  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return res.status(403).json({ error: "CSRF validation failed" });
  }

  next();
}

module.exports = { validateCsrf };
