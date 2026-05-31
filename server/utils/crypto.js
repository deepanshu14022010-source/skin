import crypto from "node:crypto";
import { config, isProduction } from "../config.js";
import bcrypt from "bcryptjs";

export function id(prefix = "") {
  return `${prefix}${crypto.randomUUID()}`;
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith("$2")) return false;
  return bcrypt.compareSync(password, stored);
}

export function createSessionToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const signature = crypto.createHmac("sha256", config.sessionSecret).update(raw).digest("hex");
  return `${raw}.${signature}`;
}

export function verifySessionToken(signedToken) {
  const [raw, signature] = String(signedToken || "").split(".");
  if (!raw || !signature) return null;
  const expected = crypto.createHmac("sha256", config.sessionSecret).update(raw).digest("hex");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return raw;
}

export function tokenHash(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function sessionCookie(token) {
  return [
    `akrivo_session=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${60 * 60 * 24 * 14}`,
    isProduction ? "Secure" : ""
  ].filter(Boolean).join("; ");
}

export function clearSessionCookie() {
  return "akrivo_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

export function createCsrfToken() {
  const raw = crypto.randomBytes(24).toString("hex");
  const signature = crypto.createHmac("sha256", config.sessionSecret).update(raw).digest("hex");
  return { raw, signed: `${raw}.${signature}` };
}

export function verifyCsrfToken(raw, signed) {
  const [cookieRaw, signature] = String(signed || "").split(".");
  if (!raw || !cookieRaw || !signature || raw !== cookieRaw) return false;
  const expected = crypto.createHmac("sha256", config.sessionSecret).update(raw).digest("hex");
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function csrfCookie(signedToken) {
  return [
    `akrivo_csrf=${signedToken}`,
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${60 * 60 * 24}`,
    isProduction ? "Secure" : ""
  ].filter(Boolean).join("; ");
}
