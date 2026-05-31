import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { createImageAsset } from "../models/factories.js";
import { apiError } from "../utils/http.js";
import { markSuspiciousUpload } from "../middleware/security.js";

const dataUrlPattern = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;

export function saveImage(db, userId, input, req) {
  if (input.uploadPurpose === "analysis" && !input.aiProcessingConsent) {
    throw apiError("AI processing consent is required for analysis photos.", 400);
  }
  const match = String(input.dataUrl || "").match(dataUrlPattern);
  if (!match) {
    if (req) markSuspiciousUpload(req, "invalid_data_url");
    throw apiError("Upload a JPG, PNG, or WEBP image.", 400);
  }
  const fileType = match[1].replace("jpg", "jpeg");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length > config.maxImageBytes) throw apiError("Image is too large for this MVP.", 413);
  const detected = detectImage(buffer);
  if (!detected || detected.fileType !== fileType) {
    if (req) markSuspiciousUpload(req, "magic_byte_mismatch");
    throw apiError("Image type does not match the uploaded file.", 400);
  }
  const dimensions = readDimensions(buffer, detected.kind);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width * dimensions.height > config.maxImagePixels) {
    if (req) markSuspiciousUpload(req, "invalid_dimensions");
    throw apiError("Image dimensions are not allowed.", 400);
  }
  const safeBuffer = stripMetadata(buffer, detected.kind);
  fs.mkdirSync(config.imageStorageDir, { recursive: true });
  const extension = fileType.split("/")[1] === "jpeg" ? "jpg" : fileType.split("/")[1];
  const tempAsset = createImageAsset(userId, {
    storagePath: "",
    fileType,
    fileSize: safeBuffer.length,
    uploadPurpose: input.uploadPurpose || "analysis"
  });
  const filename = `${tempAsset.id}.${extension}`;
  const storagePath = path.join(config.imageStorageDir, filename);
  fs.writeFileSync(storagePath, safeBuffer, { mode: 0o600 });
  tempAsset.storagePath = storagePath;
  tempAsset.width = dimensions.width;
  tempAsset.height = dimensions.height;
  db.imageAssets[tempAsset.id] = tempAsset;
  return tempAsset;
}

export function deleteImage(db, userId, imageId) {
  const asset = db.imageAssets[imageId];
  if (!asset || asset.userId !== userId || asset.deletedAt) throw apiError("Image not found.", 404);
  asset.deletedAt = new Date().toISOString();
  try {
    if (asset.storagePath && fs.existsSync(asset.storagePath)) fs.unlinkSync(asset.storagePath);
  } catch {
    // Keep metadata deleted even if local cleanup fails.
  }
  return asset;
}

export function readImageDataUrl(db, userId, imageId) {
  const asset = db.imageAssets[imageId];
  if (!asset || asset.userId !== userId || asset.deletedAt) return "";
  if (!asset.storagePath || !fs.existsSync(asset.storagePath)) return "";
  return `data:${asset.fileType};base64,${fs.readFileSync(asset.storagePath).toString("base64")}`;
}

function detectImage(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { kind: "jpeg", fileType: "image/jpeg" };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: "png", fileType: "image/png" };
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return { kind: "webp", fileType: "image/webp" };
  return null;
}

function readDimensions(buffer, kind) {
  if (kind === "png") return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (kind === "jpeg") return readJpegDimensions(buffer);
  if (kind === "webp") return readWebpDimensions(buffer);
  return null;
}

function readJpegDimensions(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebpDimensions(buffer) {
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }
  if (chunk === "VP8 " && buffer.length >= 30) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function stripMetadata(buffer, kind) {
  if (kind === "jpeg") return stripJpegMetadata(buffer);
  if (kind === "png") return stripPngMetadata(buffer);
  if (kind === "webp") return stripWebpMetadata(buffer);
  return buffer;
}

function stripJpegMetadata(buffer) {
  const parts = [buffer.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) return buffer;
    const marker = buffer[offset + 1];
    if (marker === 0xda) {
      parts.push(buffer.subarray(offset));
      return Buffer.concat(parts);
    }
    const length = buffer.readUInt16BE(offset + 2);
    const segment = buffer.subarray(offset, offset + 2 + length);
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) parts.push(segment);
    offset += 2 + length;
  }
  return buffer;
}

function stripPngMetadata(buffer) {
  const parts = [buffer.subarray(0, 8)];
  let offset = 8;
  const allowed = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS"]);
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > buffer.length) return buffer;
    if (allowed.has(type)) parts.push(buffer.subarray(offset, chunkEnd));
    offset = chunkEnd;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}

function stripWebpMetadata(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return buffer;
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const chunkEnd = offset + 8 + size + (size % 2);
    if (chunkEnd > buffer.length) return buffer;
    if (!["EXIF", "XMP "].includes(type)) chunks.push(buffer.subarray(offset, chunkEnd));
    offset = chunkEnd;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "ascii");
  return Buffer.concat([header, body]);
}
