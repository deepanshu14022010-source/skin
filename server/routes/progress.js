import express from "express";
import { createProgressPhoto } from "../models/factories.js";
import { serializeUser } from "../services/authService.js";
import { apiError, asyncHandler } from "../utils/http.js";
import { idSchema, progressSchema, validate } from "../utils/validation.js";

export const progressRouter = express.Router();

progressRouter.post("/progress/photo", asyncHandler(async (req, res) => {
  const input = validate(progressSchema, req.body);
  const image = req.db.imageAssets[input.imageId];
  if (!image || image.userId !== req.user.id || image.deletedAt) throw apiError("Image not found.", 404);
  const entry = createProgressPhoto(req.user.id, {
    imageId: image.id,
    notes: input.notes,
    concerns: input.concerns,
    visibility: input.visibility === "shared" ? "shared" : "private"
  });
  req.db.progressPhotos[entry.id] = entry;
  res.status(201).json({ progressPhoto: entry, user: serializeUser(req.db, req.user) });
}));

progressRouter.get("/progress/timeline", asyncHandler(async (req, res) => {
  const timeline = Object.values(req.db.progressPhotos).filter(item => item.userId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ timeline });
}));

progressRouter.delete("/progress/:id", asyncHandler(async (req, res) => {
  validate(idSchema, req.params.id);
  const entry = req.db.progressPhotos[req.params.id];
  if (!entry || entry.userId !== req.user.id) throw apiError("Progress entry not found.", 404);
  delete req.db.progressPhotos[entry.id];
  res.json({ ok: true, user: serializeUser(req.db, req.user) });
}));
