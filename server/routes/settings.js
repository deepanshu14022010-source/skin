import express from "express";
import { SETTINGS_DEFAULTS } from "../constants.js";
import { createSettings } from "../models/factories.js";
import { serializeUser } from "../services/authService.js";
import { asyncHandler } from "../utils/http.js";
import { logSecurity } from "../utils/logger.js";
import { audit, createBreachEvent } from "../services/auditService.js";
import { retentionPolicy } from "../services/retentionService.js";
import { abuseReportSchema, accountCorrectionSchema, breachReportSchema, settingsSchema, validate } from "../utils/validation.js";

export const settingsRouter = express.Router();

settingsRouter.get("/settings", asyncHandler(async (req, res) => {
  res.json({ settings: req.db.settings[req.user.id] || createSettings(req.user.id) });
}));

settingsRouter.patch("/settings", asyncHandler(async (req, res) => {
  const input = validate(settingsSchema, req.body);
  const existing = req.db.settings[req.user.id] || createSettings(req.user.id);
  req.db.settings[req.user.id] = {
    ...existing,
    remindersEnabled: input.remindersEnabled ?? existing.remindersEnabled ?? SETTINGS_DEFAULTS.remindersEnabled,
    morningTime: String(input.morningTime || existing.morningTime || SETTINGS_DEFAULTS.morningTime).slice(0, 5),
    nightTime: String(input.nightTime || existing.nightTime || SETTINGS_DEFAULTS.nightTime).slice(0, 5),
    stepDelayMinutes: Math.max(1, Math.min(60, Number(input.stepDelayMinutes || existing.stepDelayMinutes || SETTINGS_DEFAULTS.stepDelayMinutes))),
    skipToday: Boolean(input.skipToday),
    updatedAt: new Date().toISOString()
  };
  res.json({ settings: req.db.settings[req.user.id], user: serializeUser(req.db, req.user) });
}));

settingsRouter.patch("/account/profile", asyncHandler(async (req, res) => {
  const input = validate(accountCorrectionSchema, req.body);
  req.db.users[req.user.id] = {
    ...req.user,
    ...input,
    updatedAt: new Date().toISOString()
  };
  audit(req.db, req.user.id, "account_corrected", { fields: Object.keys(input) });
  res.json({ user: serializeUser(req.db, req.db.users[req.user.id]) });
}));

settingsRouter.post("/consent/withdraw", asyncHandler(async (req, res) => {
  req.user.processingRestricted = true;
  req.user.consentWithdrawnAt = new Date().toISOString();
  req.user.updatedAt = new Date().toISOString();
  req.db.users[req.user.id] = req.user;
  audit(req.db, req.user.id, "consent_withdrawn");
  res.json({ user: serializeUser(req.db, req.user) });
}));

settingsRouter.post("/consent/restore", asyncHandler(async (req, res) => {
  req.user.processingRestricted = false;
  req.user.consentAccepted = true;
  req.user.consentWithdrawnAt = null;
  req.user.updatedAt = new Date().toISOString();
  req.db.users[req.user.id] = req.user;
  audit(req.db, req.user.id, "consent_restored");
  res.json({ user: serializeUser(req.db, req.user) });
}));

settingsRouter.get("/retention-policy", asyncHandler(async (_req, res) => {
  res.json({ retentionDays: retentionPolicy() });
}));

settingsRouter.get("/account/export", asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const exportData = {
    user: serializeUser(req.db, req.user),
    skinProfile: req.db.skinProfiles[userId] || null,
    analyses: Object.values(req.db.skinAnalyses).filter(item => item.userId === userId),
    routines: Object.values(req.db.routines).filter(item => item.userId === userId),
    routineCompletions: Object.values(req.db.routineCompletions).filter(item => item.userId === userId),
    progressPhotos: Object.values(req.db.progressPhotos).filter(item => item.userId === userId),
    imageAssets: Object.values(req.db.imageAssets).filter(item => item.userId === userId).map(asset => ({
      ...asset,
      storagePath: "[private storage path redacted]"
    }))
  };
  res.setHeader("Content-Disposition", "attachment; filename=\"akrivo-skin-export.json\"");
  res.json(exportData);
}));

settingsRouter.delete("/analysis/history", asyncHandler(async (req, res) => {
  Object.keys(req.db.skinAnalyses).forEach(key => {
    if (req.db.skinAnalyses[key].userId === req.user.id) delete req.db.skinAnalyses[key];
  });
  Object.keys(req.db.routines).forEach(key => {
    if (req.db.routines[key].userId === req.user.id) delete req.db.routines[key];
  });
  res.json({ ok: true, user: serializeUser(req.db, req.user) });
}));

settingsRouter.delete("/progress", asyncHandler(async (req, res) => {
  Object.keys(req.db.progressPhotos).forEach(key => {
    if (req.db.progressPhotos[key].userId === req.user.id) delete req.db.progressPhotos[key];
  });
  res.json({ ok: true, user: serializeUser(req.db, req.user) });
}));

settingsRouter.post("/report-abuse", asyncHandler(async (req, res) => {
  const input = validate(abuseReportSchema, req.body);
  logSecurity("user_reported_issue", { userId: maskId(req.user.id), category: input.category });
  res.status(201).json({ ok: true, message: "Report received. Support will review it." });
}));

settingsRouter.post("/breach/report", asyncHandler(async (req, res) => {
  const input = validate(breachReportSchema, req.body);
  const breachEvent = createBreachEvent(req.db, req.user.id, input);
  res.status(201).json({ ok: true, breachEvent: { id: breachEvent.id, status: breachEvent.status, createdAt: breachEvent.createdAt } });
}));

settingsRouter.delete("/account/delete", asyncHandler(async (req, res) => {
  audit(req.db, req.user.id, "account_deleted");
  delete req.db.users[req.user.id];
  delete req.db.skinProfiles[req.user.id];
  delete req.db.settings[req.user.id];
  Object.keys(req.db.sessions).forEach(key => {
    if (req.db.sessions[key].userId === req.user.id) delete req.db.sessions[key];
  });
  for (const collectionName of ["skinAnalyses", "routines", "routineCompletions", "progressPhotos", "imageAssets"]) {
    Object.keys(req.db[collectionName]).forEach(key => {
      if (req.db[collectionName][key].userId === req.user.id) delete req.db[collectionName][key];
    });
  }
  Object.keys(req.db.duoConnections).forEach(key => {
    const duo = req.db.duoConnections[key];
    if (duo.userAId === req.user.id || duo.userBId === req.user.id) delete req.db.duoConnections[key];
  });
  res.json({ ok: true });
}));

function maskId(value) {
  return `${String(value).slice(0, 7)}...`;
}
