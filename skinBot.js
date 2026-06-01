import express from "express";
import { answerSkinBot } from "../services/aiService.js";
import { asyncHandler } from "../utils/http.js";
import { skinBotSchema, validate } from "../utils/validation.js";

export const skinBotRouter = express.Router();

skinBotRouter.post("/skin-bot/chat", asyncHandler(async (req, res) => {
  const input = validate(skinBotSchema, req.body);
  const profile = req.db.skinProfiles[req.user.id] || {};
  const latestAnalysis = Object.values(req.db.skinAnalyses)
    .filter(item => item.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  const reply = await answerSkinBot({
    user: req.user,
    profile,
    latestAnalysis,
    message: input.message,
    history: input.history
  });
  res.json(reply);
}));
