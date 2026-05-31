import express from "express";
import { analyzeSkin } from "../services/aiService.js";
import { serializeUser } from "../services/authService.js";
import { createRoutineFromAi, markStep, todayRoutine } from "../services/routineService.js";
import { createSkinAnalysis } from "../models/factories.js";
import { apiError, asyncHandler } from "../utils/http.js";
import { analysisCreateSchema, routineStepSchema, validate } from "../utils/validation.js";

export const routineRouter = express.Router();

routineRouter.get("/routine/today", asyncHandler(async (req, res) => {
  res.json(todayRoutine(req.db, req.user.id));
}));

routineRouter.post("/routine/generate", asyncHandler(async (req, res) => {
  if (req.user.processingRestricted) throw apiError("Consent has been withdrawn. Routine generation is disabled.", 403);
  const input = validate(analysisCreateSchema.partial({ imageId: true }), req.body);
  const questionnaireData = { ...(req.db.skinProfiles[req.user.id] || {}), ...(input.questionnaireData || {}) };
  const aiOutput = await analyzeSkin({ imageAsset: null, questionnaireData });
  const analysis = createSkinAnalysis(req.user.id, {
    imageId: input.imageId || null,
    questionnaireData,
    aiFindings: aiOutput,
    confidenceScores: Object.fromEntries(aiOutput.visibleConcerns.map(item => [item.concern, item.confidence])),
    redFlags: aiOutput.redFlags
  });
  req.db.skinAnalyses[analysis.id] = analysis;
  const routine = createRoutineFromAi(req.db, req.user.id, analysis.id, aiOutput);
  res.status(201).json({ routine, analysis, user: serializeUser(req.db, req.user) });
}));

routineRouter.post("/routine/step-complete", asyncHandler(async (req, res) => {
  const completion = markStep(req.db, req.user.id, validate(routineStepSchema, req.body), false);
  res.json({ completion, user: serializeUser(req.db, req.user) });
}));

routineRouter.post("/routine/skip-step", asyncHandler(async (req, res) => {
  const completion = markStep(req.db, req.user.id, validate(routineStepSchema, req.body), true);
  res.json({ completion, user: serializeUser(req.db, req.user) });
}));

routineRouter.get("/routine/history", asyncHandler(async (req, res) => {
  const history = Object.values(req.db.routineCompletions).filter(item => item.userId === req.user.id).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ history });
}));
