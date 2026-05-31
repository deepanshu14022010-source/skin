import { config } from "../config.js";
import { createSettings, createUser } from "../models/factories.js";
import { createSessionToken, tokenHash, verifyPassword, verifySessionToken } from "../utils/crypto.js";
import { apiError, cookieValue, requireEmail, requirePassword, sanitizeEmail } from "../utils/http.js";

export function serializeUser(db, user) {
  if (!user) return null;
  const profile = db.skinProfiles[user.id] || null;
  const settings = db.settings[user.id] || createSettings(user.id);
  const latestAnalysis = latestByUser(db.skinAnalyses, user.id);
  const latestRoutine = latestByUser(db.routines, user.id);
  const progress = Object.values(db.progressPhotos).filter(item => item.userId === user.id).sort(descCreated);
  const completions = Object.values(db.routineCompletions).filter(item => item.userId === user.id).sort(descUpdated);
  const duo = getDuoStatus(db, user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    ageRange: user.ageRange,
    country: user.country,
    consentAccepted: user.consentAccepted,
    privacyVersionAccepted: user.privacyVersionAccepted,
    processingRestricted: Boolean(user.processingRestricted),
    consentWithdrawnAt: user.consentWithdrawnAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    skinProfile: profile,
    settings,
    latestAnalysis,
    latestRoutine,
    progress,
    routineHistory: completions,
    duo
  };
}

export function signup(db, input) {
  const email = sanitizeEmail(input.email);
  requireEmail(email);
  requirePassword(input.password);
  if (Object.values(db.users).some(user => user.email === email)) throw apiError("An account already exists for this email.", 409);
  const user = createUser({ email, password: input.password, name: input.name || "" });
  db.users[user.id] = user;
  db.settings[user.id] = createSettings(user.id);
  return user;
}

export function login(db, input) {
  const email = sanitizeEmail(input.email);
  const user = Object.values(db.users).find(candidate => candidate.email === email);
  if (!user || !verifyPassword(input.password || "", user.passwordHash)) throw apiError("Email or password is incorrect.", 401);
  return user;
}

export function findOrCreateOtpUser(db, email) {
  const sanitized = sanitizeEmail(email);
  requireEmail(sanitized);
  const existing = Object.values(db.users).find(candidate => candidate.email === sanitized);
  if (existing) return existing;
  const user = createUser({ email: sanitized, password: "", name: "" });
  db.users[user.id] = user;
  db.settings[user.id] = createSettings(user.id);
  return user;
}

export function createSession(db, userId) {
  const signedToken = createSessionToken();
  const raw = signedToken.split(".")[0];
  db.sessions[tokenHash(raw)] = {
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 24 * 14 * 1000
  };
  return signedToken;
}

export function authFromRequest(db, req) {
  const signedToken = cookieValue(req, "akrivo_session");
  const raw = verifySessionToken(signedToken);
  if (!raw) return null;
  const sessionKey = tokenHash(raw);
  const session = db.sessions[sessionKey];
  if (!session || session.expiresAt < Date.now()) return null;
  const user = db.users[session.userId];
  if (!user) return null;
  return { user, sessionKey };
}

export function destroySession(db, sessionKey) {
  if (sessionKey) delete db.sessions[sessionKey];
}

export function getDuoStatus(db, userId) {
  const duo = Object.values(db.duoConnections).find(item => item.userAId === userId || item.userBId === userId);
  if (!duo) return null;
  const partnerId = duo.userAId === userId ? duo.userBId : duo.userAId;
  const partner = partnerId ? db.users[partnerId] : null;
  return {
    id: duo.id,
    duoCode: duo.duoCode,
    status: duo.status,
    privacy: {
      shareRoutineStatus: duo.shareRoutineStatus,
      shareStreak: duo.shareStreak,
      shareProgressNotes: duo.shareProgressNotes,
      sharePhotos: duo.sharePhotos
    },
    partner: partner ? serializePartner(db, partner, duo) : null
  };
}

function serializePartner(db, partner, duo) {
  const completions = Object.values(db.routineCompletions).filter(item => item.userId === partner.id);
  const today = new Date().toISOString().slice(0, 10);
  const morning = completions.find(item => item.date === today && item.routineType === "morning");
  const night = completions.find(item => item.date === today && item.routineType === "night");
  const progress = Object.values(db.progressPhotos).filter(item => item.userId === partner.id && item.visibility === "shared");
  return {
    name: partner.name || partner.email.split("@")[0],
    routineStatus: duo.shareRoutineStatus ? { morning: Boolean(morning?.completedAt), night: Boolean(night?.completedAt) } : null,
    streak: duo.shareStreak ? calculateStreak(completions) : null,
    progressNotes: duo.shareProgressNotes ? progress.slice(0, 3).map(item => ({ createdAt: item.createdAt, notes: item.notes })) : []
  };
}

function calculateStreak(completions) {
  const completeDates = new Set(completions.filter(item => item.completedAt).map(item => item.date));
  let streak = 0;
  const cursor = new Date();
  while (completeDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function latestByUser(collection, userId) {
  return Object.values(collection).filter(item => item.userId === userId).sort(descCreated)[0] || null;
}

function descCreated(a, b) {
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

function descUpdated(a, b) {
  return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
}
