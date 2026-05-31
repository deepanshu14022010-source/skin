import { id } from "../utils/crypto.js";
import { logSecurity } from "../utils/logger.js";

export function audit(db, actorUserId, action, details = {}) {
  const event = {
    id: id("aud_"),
    actorUserId: mask(actorUserId),
    action,
    details: redact(details),
    createdAt: new Date().toISOString()
  };
  db.auditLogs[event.id] = event;
  logSecurity(action, event);
  return event;
}

export function createBreachEvent(db, actorUserId, input) {
  const event = {
    id: id("brc_"),
    reportedBy: mask(actorUserId),
    category: input.category || "suspected-breach",
    summary: String(input.summary || input.message || "").slice(0, 1200),
    status: "triage",
    notificationRecords: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.breachEvents[event.id] = event;
  audit(db, actorUserId, "suspected_breach_reported", { breachEventId: event.id, category: event.category });
  return event;
}

export function mask(value) {
  if (!value) return "system";
  return `${String(value).slice(0, 7)}...`;
}

function redact(value) {
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (/email|photo|image|token|secret|password/i.test(key)) return [key, "[redacted]"];
    return [key, entry && typeof entry === "object" ? redact(entry) : entry];
  }));
}
