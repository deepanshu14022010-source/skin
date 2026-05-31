import express from "express";
import { config } from "../config.js";
import { createSkinProfile } from "../models/factories.js";
import { serializeUser } from "../services/authService.js";
import { apiError, asyncHandler } from "../utils/http.js";
import { onboardingSchema, validate } from "../utils/validation.js";

export const onboardingRouter = express.Router();

onboardingRouter.post("/onboarding", asyncHandler(async (req, res) => {
  const input = validate(onboardingSchema, req.body);
  if (!input.consentAccepted) throw apiError("Consent is required before photo analysis.", 400);
  if (!input.photoConsentAccepted || !input.aiProcessingConsentAccepted || !input.understandsWellnessOnly) {
    throw apiError("Photo ownership, AI processing, and wellness-only consent are required.", 400);
  }
  if (input.ageRange === "13-17" && !input.guardianConsentAccepted) {
    throw apiError("Parent or guardian consent is required for this age range where applicable.", 400);
  }
  const now = new Date().toISOString();
  req.user.name = input.name;
  req.user.ageRange = input.ageRange;
  req.user.country = input.country;
  req.user.consentAccepted = true;
  req.user.guardianConsentAccepted = Boolean(input.guardianConsentAccepted);
  req.user.photoConsentAccepted = Boolean(input.photoConsentAccepted);
  req.user.aiProcessingConsentAccepted = Boolean(input.aiProcessingConsentAccepted);
  req.user.understandsWellnessOnly = Boolean(input.understandsWellnessOnly);
  req.user.privacyVersionAccepted = config.privacyVersion;
  req.user.updatedAt = now;
  req.db.users[req.user.id] = req.user;
  req.db.skinProfiles[req.user.id] = createSkinProfile(req.user.id, input);
  res.status(201).json({ user: serializeUser(req.db, req.user), skinProfile: req.db.skinProfiles[req.user.id] });
}));

onboardingRouter.get("/skin-profile", asyncHandler(async (req, res) => {
  res.json({ skinProfile: req.db.skinProfiles[req.user.id] || null });
}));

onboardingRouter.patch("/skin-profile", asyncHandler(async (req, res) => {
  const input = validate(onboardingSchema.partial().omit({ consentAccepted: true }), req.body);
  const existing = req.db.skinProfiles[req.user.id] || createSkinProfile(req.user.id, {});
  req.db.skinProfiles[req.user.id] = {
    ...existing,
    ...input,
    userId: req.user.id,
    updatedAt: new Date().toISOString()
  };
  res.json({ user: serializeUser(req.db, req.user), skinProfile: req.db.skinProfiles[req.user.id] });
}));
