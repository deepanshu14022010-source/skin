import express from "express";
import { createSkinAnalysis } from "../models/factories.js";
import { analyzeSkin } from "../services/aiService.js";
import { audit } from "../services/auditService.js";
import { serializeUser } from "../services/authService.js";
import { readImageDataUrl } from "../services/imageService.js";
import { createRoutineFromAi } from "../services/routineService.js";
import { apiError, asyncHandler } from "../utils/http.js";
import { analysisCreateSchema, idSchema, validate } from "../utils/validation.js";

export const analysisRouter = express.Router();

analysisRouter.post("/analysis/create", asyncHandler(async (req, res) => {
  if (req.user.processingRestricted) throw apiError("Consent has been withdrawn. AI processing is disabled.", 403);
  const input = validate(analysisCreateSchema, req.body);
  const imageAsset = req.db.imageAssets[input.imageId];
  if (!imageAsset || imageAsset.userId !== req.user.id || imageAsset.deletedAt) throw apiError("Image not found.", 404);
  const questionnaireData = {
    ...(req.db.skinProfiles[req.user.id] || {}),
    ...(input.questionnaireData || {})
  };
  const aiOutput = await analyzeSkin({ imageAsset, questionnaireData });
  const analysis = createSkinAnalysis(req.user.id, {
    imageId: imageAsset.id,
    questionnaireData,
    aiFindings: aiOutput,
    confidenceScores: Object.fromEntries(aiOutput.visibleConcerns.map(item => [item.concern, item.confidence])),
    redFlags: aiOutput.redFlags
  });
  req.db.skinAnalyses[analysis.id] = analysis;
  const routine = createRoutineFromAi(req.db, req.user.id, analysis.id, aiOutput);
  audit(req.db, req.user.id, "analysis_created", { analysisId: analysis.id, imageId: imageAsset.id });
  res.status(201).json({ analysis, routine, aiOutput, user: serializeUser(req.db, req.user) });
}));

analysisRouter.get("/analysis/latest", asyncHandler(async (req, res) => {
  const analysis = Object.values(req.db.skinAnalyses).filter(item => item.userId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  const imagePreview = analysis ? readImageDataUrl(req.db, req.user.id, analysis.imageId) : "";
  res.json({ analysis, imagePreview });
}));

analysisRouter.get("/analysis/:id", asyncHandler(async (req, res) => {
  validate(idSchema, req.params.id);
  const analysis = req.db.skinAnalyses[req.params.id];
  if (!analysis || analysis.userId !== req.user.id) throw apiError("Analysis not found.", 404);
  res.json({ analysis, imagePreview: readImageDataUrl(req.db, req.user.id, analysis.imageId) });
}));
