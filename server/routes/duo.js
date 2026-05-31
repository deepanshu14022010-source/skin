import express from "express";
import { serializeUser } from "../services/authService.js";
import { createDuoCode, disconnectDuo, joinDuo, updateDuoPrivacy } from "../services/duoService.js";
import { asyncHandler } from "../utils/http.js";
import { duoJoinSchema, duoPrivacySchema, validate } from "../utils/validation.js";

export const duoRouter = express.Router();

duoRouter.post("/duo/create-code", asyncHandler(async (req, res) => {
  const duo = createDuoCode(req.db, req.user.id);
  res.status(201).json({ duo, user: serializeUser(req.db, req.user) });
}));

duoRouter.post("/duo/join", asyncHandler(async (req, res) => {
  const input = validate(duoJoinSchema, req.body);
  const duo = joinDuo(req.db, req.user.id, input.duoCode || input.code);
  res.json({ duo, user: serializeUser(req.db, req.user) });
}));

duoRouter.get("/duo/status", asyncHandler(async (req, res) => {
  res.json({ duo: serializeUser(req.db, req.user).duo });
}));

duoRouter.patch("/duo/privacy", asyncHandler(async (req, res) => {
  const duo = updateDuoPrivacy(req.db, req.user.id, validate(duoPrivacySchema, req.body));
  res.json({ duo, user: serializeUser(req.db, req.user) });
}));

duoRouter.delete("/duo/disconnect", asyncHandler(async (req, res) => {
  disconnectDuo(req.db, req.user.id);
  res.json({ ok: true, user: serializeUser(req.db, req.user) });
}));
