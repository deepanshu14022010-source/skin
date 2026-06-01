import express from "express";
import { store } from "../db/localStore.js";
import { clearSessionCookie, hashPassword, sessionCookie } from "../utils/crypto.js";
import { apiError, asyncHandler, clientIp, sanitizeEmail } from "../utils/http.js";
import { authFromRequest, createSession, destroySession, findOrCreateOtpUser, login, serializeUser, signup, verifySignupUser } from "../services/authService.js";
import { logSecurity } from "../utils/logger.js";
import { assertEmailConfigured, sendOtpEmail } from "../services/emailService.js";
import { createEmailOtp, verifyEmailOtp } from "../services/otpService.js";
import { authSchema, forgotPasswordSchema, otpRequestSchema, otpVerifySchema, passwordResetSchema, signupVerifySchema, validate } from "../utils/validation.js";

export const authRouter = express.Router();
const failedAuth = new Map();
const maxFailedAttempts = 5;
const authWindowMs = 15 * 60 * 1000;

authRouter.post("/signup", asyncHandler(async (req, res) => {
  const input = validate(authSchema, req.body);
  assertEmailConfigured();
  store.transaction(db => {
    const user = signup(db, input);
  });
  const otp = store.transaction(db => createEmailOtp(db, input.email, clientIp(req)));
  let delivery;
  try {
    delivery = await sendOtpEmail(input.email, otp, "signup");
  } catch (error) {
    store.transaction(db => {
      const user = Object.values(db.users).find(candidate => candidate.email === input.email);
      if (user && !user.emailVerifiedAt) delete db.users[user.id];
      delete db.emailOtps[input.email];
    });
    throw error;
  }
  logSecurity("signup_otp_requested", { ip: clientIp(req), email: maskEmail(input.email) });
  res.status(201).json({ ok: true, requiresOtp: true, email: input.email, ...(delivery?.devOtp ? { devOtp: delivery.devOtp } : {}) });
}));

authRouter.post("/signup/verify", asyncHandler(async (req, res) => {
  const input = validate(signupVerifySchema, req.body);
  const result = store.transaction(db => {
    verifyEmailOtp(db, input.email, input.otp);
    const user = verifySignupUser(db, input.email);
    const token = createSession(db, user.id);
    return { user: serializeUser(db, user), token };
  });
  res.setHeader("Set-Cookie", sessionCookie(result.token));
  res.json({ user: result.user });
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

authRouter.post("/otp/request", asyncHandler(async (req, res) => {
  const input = validate(otpRequestSchema, req.body);
  assertEmailConfigured();
  const otp = store.transaction(db => createEmailOtp(db, input.email, clientIp(req)));
  let delivery;
  try {
    delivery = await sendOtpEmail(input.email, otp);
  } catch (error) {
    store.transaction(db => {
      delete db.emailOtps[sanitizeEmail(input.email)];
    });
    throw error;
  }
  logSecurity("otp_requested", { ip: clientIp(req), email: maskEmail(input.email) });
  res.json({ ok: true, message: "Verification code sent.", ...(delivery?.devOtp ? { devOtp: delivery.devOtp } : {}) });
}));

authRouter.post("/otp/verify", asyncHandler(async (req, res) => {
  const input = validate(otpVerifySchema, req.body);
  const result = store.transaction(db => {
    verifyEmailOtp(db, input.email, input.otp);
    const user = findOrCreateOtpUser(db, input.email);
    const token = createSession(db, user.id);
    return { user: serializeUser(db, user), token };
  });
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
  const input = validate(forgotPasswordSchema, req.body);
  assertEmailConfigured();
  const db = store.read();
  const userExists = Object.values(db.users).some(user => user.email === input.email);
  let delivery;
  if (userExists) {
    const otp = store.transaction(current => createEmailOtp(current, input.email, clientIp(req)));
    try {
      delivery = await sendOtpEmail(input.email, otp, "password-reset");
    } catch (error) {
      store.transaction(current => {
        delete current.emailOtps[sanitizeEmail(input.email)];
      });
      throw error;
    }
    logSecurity("password_reset_otp_requested", { ip: clientIp(req), email: maskEmail(input.email) });
  }
  res.json({ ok: true, message: "If an account exists, a verification code has been sent.", ...(delivery?.devOtp ? { devOtp: delivery.devOtp } : {}) });
}));

authRouter.post("/password-reset/verify", asyncHandler(async (req, res) => {
  const input = validate(passwordResetSchema, req.body);
  const result = store.transaction(db => {
    verifyEmailOtp(db, input.email, input.otp);
    const user = Object.values(db.users).find(candidate => candidate.email === input.email);
    if (!user) throw apiError("Verification code is invalid or expired.", 401);
    user.passwordHash = hashPassword(input.password);
    user.updatedAt = new Date().toISOString();
    db.users[user.id] = user;
    const token = createSession(db, user.id);
    return { user: serializeUser(db, user), token };
  });
  res.setHeader("Set-Cookie", sessionCookie(result.token));
  res.json({ user: result.user });
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

function maskEmail(email) {
  const [name, domain] = String(email).split("@");
  return `${name.slice(0, 2)}***@${domain || "unknown"}`;
}
