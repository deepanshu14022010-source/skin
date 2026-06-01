import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config, isProduction } from "../config.js";
import { clientIp, apiError, cookieValue } from "../utils/http.js";
import { createCsrfToken, csrfCookie, verifyCsrfToken } from "../utils/crypto.js";
import { logSecurity } from "../utils/logger.js";

const suspiciousUploads = new Map();

export function securityMiddleware(app) {
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    if (isProduction && req.headers["x-forwarded-proto"] !== "https" && !req.secure) {
      return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    }
    return next();
  });

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://checkout.razorpay.com"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
        "frame-src": ["'self'", "https://api.razorpay.com", "https://checkout.razorpay.com"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"]
      }
    },
    hsts: isProduction ? { maxAge: 15552000, includeSubDomains: true, preload: true } : false,
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "same-origin" }
  }));

  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    next();
  });

  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      if (!isProduction && isLocalDevOrigin(origin)) return callback(null, true);
      return callback(apiError("Origin not allowed.", 403));
    },
    credentials: true
  }));

  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: req => clientIp(req),
    handler(req, res) {
      logSecurity("global_rate_limited", { ip: clientIp(req), path: req.path });
      res.status(429).json({ error: "Too many requests. Please slow down." });
    }
  }));
}

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => clientIp(req),
  handler(req, res) {
    logSecurity("upload_rate_limited", { ip: clientIp(req) });
    res.status(429).json({ error: "Too many upload attempts. Please try later." });
  }
});

function isLocalDevOrigin(origin) {
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname) && ["3000", "5173"].includes(url.port || "80");
  } catch {
    return false;
  }
}

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => `${req.user?.id || clientIp(req)}:${new Date().toISOString().slice(0, 13)}`,
  handler(req, res) {
    logSecurity("ai_rate_limited", { userId: req.user?.id, ip: clientIp(req) });
    res.status(429).json({ error: "AI analysis limit reached. Please try again later." });
  }
});

export function ensureCsrfCookie(_req, res, next) {
  const token = createCsrfToken();
  res.setHeader("Set-Cookie", appendCookie(res.getHeader("Set-Cookie"), csrfCookie(token.signed)));
  res.locals.csrfToken = token.raw;
  next();
}

export function csrfRoute(_req, res) {
  const token = createCsrfToken();
  res.setHeader("Set-Cookie", csrfCookie(token.signed));
  res.json({ csrfToken: token.raw });
}

export function requireCsrf(req, _res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const header = req.headers["x-csrf-token"];
  const cookie = cookieValue(req, "akrivo_csrf");
  if (!verifyCsrfToken(header, cookie)) {
    logSecurity("csrf_rejected", { ip: clientIp(req), path: req.path });
    return next(apiError("Invalid security token. Refresh and try again.", 403));
  }
  return next();
}

export function blockSuspiciousUpload(req, _res, next) {
  const key = clientIp(req);
  const record = suspiciousUploads.get(key);
  if (record && record.blockUntil > Date.now()) return next(apiError("Upload access temporarily blocked after suspicious activity.", 429));
  return next();
}

export function markSuspiciousUpload(req, reason) {
  const key = clientIp(req);
  const record = suspiciousUploads.get(key) || { count: 0, blockUntil: 0 };
  record.count += 1;
  if (record.count >= 3) record.blockUntil = Date.now() + 30 * 60 * 1000;
  suspiciousUploads.set(key, record);
  logSecurity("suspicious_upload", { ip: key, reason, count: record.count });
}

function appendCookie(existing, nextCookie) {
  if (!existing) return nextCookie;
  return Array.isArray(existing) ? [...existing, nextCookie] : [existing, nextCookie];
}
