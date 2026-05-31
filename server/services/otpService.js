import crypto from "node:crypto";
import { config } from "../config.js";
import { apiError, sanitizeEmail } from "../utils/http.js";

const otpTtlMs = 10 * 60 * 1000;
const resendMs = 60 * 1000;
const rateWindowMs = 15 * 60 * 1000;
const maxRequests = 5;
const maxAttempts = 5;

export function createEmailOtp(db, email, ip) {
  ensureOtpCollections(db);
  cleanupOtps(db);
  const sanitized = sanitizeEmail(email);
  assertRequestAllowed(db, sanitized, ip);
  const existing = db.emailOtps[sanitized];
  if (existing && existing.resendAvailableAt > Date.now()) {
    const seconds = Math.ceil((existing.resendAvailableAt - Date.now()) / 1000);
    throw apiError(`Please wait ${seconds} seconds before requesting another code.`, 429);
  }

  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = crypto.randomBytes(16).toString("hex");
  db.emailOtps[sanitized] = {
    otpHash: hashOtp(sanitized, otp, salt),
    salt,
    attempts: 0,
    createdAt: Date.now(),
    expiresAt: Date.now() + otpTtlMs,
    resendAvailableAt: Date.now() + resendMs
  };
  return otp;
}

export function verifyEmailOtp(db, email, otp) {
  ensureOtpCollections(db);
  const sanitized = sanitizeEmail(email);
  const challenge = db.emailOtps[sanitized];
  if (!challenge) throw apiError("Verification code is invalid or expired.", 401);
  if (challenge.expiresAt < Date.now()) {
    delete db.emailOtps[sanitized];
    throw apiError("Verification code is invalid or expired.", 401);
  }
  if (challenge.attempts >= maxAttempts) {
    delete db.emailOtps[sanitized];
    throw apiError("Too many incorrect codes. Request a new verification code.", 429);
  }
  if (!otpMatches(sanitized, otp, challenge)) {
    challenge.attempts += 1;
    if (challenge.attempts >= maxAttempts) delete db.emailOtps[sanitized];
    throw apiError("Verification code is incorrect.", 401);
  }
  delete db.emailOtps[sanitized];
}

function assertRequestAllowed(db, email, ip) {
  const key = rateKey(email, ip);
  const now = Date.now();
  const current = (db.otpRequestLimits[key] || []).filter(timestamp => now - timestamp < rateWindowMs);
  if (current.length >= maxRequests) throw apiError("Too many verification code requests. Please try again later.", 429);
  current.push(now);
  db.otpRequestLimits[key] = current;
}

function cleanupOtps(db) {
  const now = Date.now();
  for (const [email, challenge] of Object.entries(db.emailOtps)) {
    if (!challenge || challenge.expiresAt < now) delete db.emailOtps[email];
  }
  for (const [key, timestamps] of Object.entries(db.otpRequestLimits)) {
    const current = timestamps.filter(timestamp => now - timestamp < rateWindowMs);
    if (current.length) db.otpRequestLimits[key] = current;
    else delete db.otpRequestLimits[key];
  }
}

function ensureOtpCollections(db) {
  db.emailOtps ||= {};
  db.otpRequestLimits ||= {};
}

function hashOtp(email, otp, salt) {
  return crypto.createHmac("sha256", config.sessionSecret).update(`${email}:${salt}:${otp}`).digest("hex");
}

function otpMatches(email, otp, challenge) {
  const expected = hashOtp(email, otp, challenge.salt);
  if (expected.length !== challenge.otpHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(challenge.otpHash));
}

function rateKey(email, ip) {
  return crypto.createHash("sha256").update(`${email}:${ip}`).digest("hex");
}
