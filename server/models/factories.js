import { config } from "../config.js";
import { PRIVACY_DEFAULTS, SETTINGS_DEFAULTS } from "../constants.js";
import { hashPassword, id } from "../utils/crypto.js";

export function createUser({ email, password, name = "" }) {
  const now = new Date().toISOString();
  return {
    id: id("usr_"),
    email,
    passwordHash: hashPassword(password),
    name,
    ageRange: "",
    country: "",
    createdAt: now,
    updatedAt: now,
    consentAccepted: false,
    consentWithdrawnAt: null,
    processingRestricted: false,
    guardianConsentAccepted: false,
    consentWithdrawnAt: null,
    privacyVersionAccepted: config.privacyVersion
  };
}

export function createSettings(userId) {
  return { userId, ...SETTINGS_DEFAULTS, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function createSkinProfile(userId, input) {
  const now = new Date().toISOString();
  return {
    userId,
    skinType: input.skinType || "unknown",
    concerns: Array.isArray(input.concerns) ? input.concerns : [],
    allergies: normalizeList(input.allergies),
    currentRoutine: String(input.currentRoutine || ""),
    budgetLevel: input.budgetLevel || input.budget || "medium",
    sensitivityLevel: input.sensitivityLevel || "unknown",
    createdAt: now,
    updatedAt: now
  };
}

export function createImageAsset(userId, input) {
  return {
    id: id("img_"),
    userId,
    storagePath: input.storagePath,
    fileType: input.fileType || "image/jpeg",
    fileSize: Number(input.fileSize || 0),
    uploadPurpose: input.uploadPurpose || "analysis",
    createdAt: new Date().toISOString(),
    deletedAt: null
  };
}

export function createSkinAnalysis(userId, input) {
  return {
    id: id("ana_"),
    userId,
    imageId: input.imageId,
    questionnaireData: input.questionnaireData || {},
    aiFindings: input.aiFindings,
    confidenceScores: input.confidenceScores || {},
    redFlags: input.redFlags || [],
    routineRecommendationId: input.routineRecommendationId || null,
    createdAt: new Date().toISOString()
  };
}

export function createRoutine(userId, input) {
  const now = new Date().toISOString();
  return {
    id: id("rtn_"),
    userId,
    morningSteps: input.morningSteps || [],
    nightSteps: input.nightSteps || [],
    cautions: input.cautions || [],
    generatedFromAnalysisId: input.generatedFromAnalysisId,
    createdAt: now,
    updatedAt: now
  };
}

export function createCompletion(userId, input) {
  return {
    id: id("cmp_"),
    userId,
    date: input.date || new Date().toISOString().slice(0, 10),
    routineType: input.routineType,
    stepsCompleted: input.stepsCompleted || [],
    skippedSteps: input.skippedSteps || [],
    completedAt: input.completedAt || null,
    updatedAt: new Date().toISOString()
  };
}

export function createProgressPhoto(userId, input) {
  return {
    id: id("prg_"),
    userId,
    imageId: input.imageId,
    notes: String(input.notes || ""),
    concerns: Array.isArray(input.concerns) ? input.concerns : [],
    createdAt: new Date().toISOString(),
    visibility: input.visibility || "private"
  };
}

export function createDuoConnection(userAId, duoCode) {
  return {
    id: id("duo_"),
    userAId,
    userBId: null,
    duoCode,
    status: "pending",
    ...PRIVACY_DEFAULTS,
    createdAt: new Date().toISOString()
  };
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(",").map(item => item.trim()).filter(Boolean);
}
