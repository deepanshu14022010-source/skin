import express from "express";
import { blockSuspiciousUpload } from "../middleware/security.js";
import { deleteImage, saveImage } from "../services/imageService.js";
import { audit } from "../services/auditService.js";
import { apiError, asyncHandler } from "../utils/http.js";
import { idSchema, imageUploadSchema, validate } from "../utils/validation.js";

export const imagesRouter = express.Router();

imagesRouter.post("/images/upload", blockSuspiciousUpload, asyncHandler(async (req, res) => {
  if (req.user.processingRestricted) throw apiError("Consent has been withdrawn. Upload processing is disabled until consent is restored.", 403);
  const input = validate(imageUploadSchema, req.body);
  const asset = saveImage(req.db, req.user.id, input, req);
  audit(req.db, req.user.id, "image_uploaded", { imageId: asset.id, uploadPurpose: asset.uploadPurpose });
  res.status(201).json({ image: asset });
}));

imagesRouter.delete("/images/:id", asyncHandler(async (req, res) => {
  validate(idSchema, req.params.id);
  const image = deleteImage(req.db, req.user.id, req.params.id);
  audit(req.db, req.user.id, "image_deleted", { imageId: req.params.id });
  res.json({ image });
}));
