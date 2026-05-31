import { createDuoConnection } from "../models/factories.js";
import { apiError } from "../utils/http.js";

export function createDuoCode(db, userId) {
  const existing = Object.values(db.duoConnections).find(item => item.userAId === userId || item.userBId === userId);
  if (existing) return existing;
  const duo = createDuoConnection(userId, makeCode(db));
  db.duoConnections[duo.id] = duo;
  return duo;
}

export function joinDuo(db, userId, rawCode) {
  const code = String(rawCode || "").trim().toUpperCase();
  const duo = Object.values(db.duoConnections).find(item => item.duoCode === code);
  if (!duo) throw apiError("That duo code was not found.", 404);
  if (duo.userAId === userId || duo.userBId === userId) return duo;
  if (duo.userBId) throw apiError("That duo already has two members.", 409);
  if (Object.values(db.duoConnections).some(item => item.userAId === userId || item.userBId === userId)) {
    throw apiError("Disconnect your current duo before joining another.", 409);
  }
  duo.userBId = userId;
  duo.status = "active";
  return duo;
}

export function updateDuoPrivacy(db, userId, input) {
  const duo = Object.values(db.duoConnections).find(item => item.userAId === userId || item.userBId === userId);
  if (!duo) throw apiError("No duo connection found.", 404);
  duo.shareRoutineStatus = Boolean(input.shareRoutineStatus);
  duo.shareStreak = Boolean(input.shareStreak);
  duo.shareProgressNotes = Boolean(input.shareProgressNotes);
  duo.sharePhotos = false;
  return duo;
}

export function disconnectDuo(db, userId) {
  const duo = Object.values(db.duoConnections).find(item => item.userAId === userId || item.userBId === userId);
  if (!duo) return null;
  delete db.duoConnections[duo.id];
  return duo;
}

function makeCode(db) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = "";
    for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!Object.values(db.duoConnections).some(item => item.duoCode === code)) return code;
  }
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
