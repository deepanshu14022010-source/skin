import express from "express";
import { store } from "../db/localStore.js";
import { clearSessionCookie, sessionCookie } from "../utils/crypto.js";
import { apiError, asyncHandler, clientIp, sanitizeEmail } from "../utils/http.js";
import { authFromRequest, createSession, destroySession, login, serializeUser, signup } from "../services/authService.js";
import { logSecurity } from "../utils/logger.js";
import { authSchema, forgotPasswordSchema, validate } from "../utils/validation.js";

export const authRouter = express.Router();
const failedAuth = new Map();
const maxFailedAttempts = 5;
const authWindowMs = 15 * 60 * 1000;

authRouter.post("/signup", asyncHandler(async (req, res) => {
  const input = validate(authSchema, req.body);
  const result = store.transaction(db => {
    const user = signup(db, input);
    const token = createSession(db, user.id);
    return { user: serializeUser(db, user), token };
  });
  res.setHeader("Set-Cookie", sessionCookie(result.token));
  res.status(201).json({ user: result.user });
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const input = validate(authSchema, req.body);
  const key = authKey(req, input.email);
  assertAuthAllowed(key);
  let result;
  try {
    result = store.transaction(db => {
      const user = login(db, input);
      const token = createSession(db, user.id);
      clearFailures(key);
      return { user: serializeUser(db, user), token };
    });
  } catch (error) {
    recordFailure(key, req, input.email);
    throw error;
  }
  res.setHeader("Set-Cookie", sessionCookie(result.token));
  res.json({ user: result.user });
}));

authRouter.post("/logout", asyncHandler(async (req, res) => {
  store.transaction(db => {
    const auth = authFromRequest(db, req);
    if (auth) destroySession(db, auth.sessionKey);
  });
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ ok: true });
}));

authRouter.post("/forgot-password", asyncHandler(async (req, res) => {
  validate(forgotPasswordSchema, req.body);
  res.json({ ok: true, message: "If an account exists, a reset email can be sent after email delivery is configured." });
}));

authRouter.get("/me", asyncHandler(async (req, res) => {
  const db = store.read();
  const auth = authFromRequest(db, req);
  res.status(auth ? 200 : 401).json(auth ? { user: serializeUser(db, auth.user) } : { error: "Not signed in." });
}));

function authKey(req, email) {
  return `${clientIp(req)}:${sanitizeEmail(email)}`;
}

function assertAuthAllowed(key) {
  const record = failedAuth.get(key);
  if (record && record.count >= maxFailedAttempts && record.expiresAt > Date.now()) {
    throw apiError("Too many failed login attempts. Please try again later.", 429);
  }
}

function recordFailure(key, req, email) {
  const current = failedAuth.get(key);
  const record = current && current.expiresAt > Date.now() ? current : { count: 0, expiresAt: Date.now() + authWindowMs };
  record.count += 1;
  failedAuth.set(key, record);
  logSecurity("failed_login", { ip: clientIp(req), email, count: record.count });
}

function clearFailures(key) {
  failedAuth.delete(key);
}
