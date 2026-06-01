import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(path.join(rootDir, ".env"));
const env = process.env.NODE_ENV || "development";

export const config = {
  rootDir,
  env,
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3000),
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-change-before-production",
  dataDir: path.resolve(rootDir, process.env.DATA_DIR || "data"),
  imageStorageDriver: process.env.IMAGE_STORAGE_DRIVER || "local",
  imageStorageDir: path.resolve(rootDir, process.env.IMAGE_STORAGE_DIR || "data/uploads"),
  aiProvider: process.env.AI_PROVIDER || "mock",
  aiApiUrl: process.env.AI_API_URL || "",
  aiApiKey: process.env.AI_API_KEY || "",
  aiModel: process.env.AI_MODEL || "",
  paymentProvider: process.env.PAYMENT_PROVIDER || "razorpay",
  razorpayTestMode: process.env.RAZORPAY_TEST_MODE !== "false",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  emailProvider: process.env.EMAIL_PROVIDER || (env === "production" || process.env.BREVO_API_KEY ? "brevo" : "console"),
  brevoApiKey: process.env.BREVO_API_KEY || "",
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || "no-reply@akrivoskin.example",
  brevoSenderName: process.env.BREVO_SENDER_NAME || "AKRIVO Skin",
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || "",
  corsOrigins: (process.env.CORS_ORIGINS || "http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:5173,http://localhost:5173").split(",").map(item => item.trim()).filter(Boolean),
  maxJsonBytes: process.env.MAX_JSON_BYTES || "6mb",
  maxImageBytes: Number(process.env.MAX_IMAGE_BYTES || 4_500_000),
  maxImagePixels: Number(process.env.MAX_IMAGE_PIXELS || 12_000_000),
  privacyVersion: process.env.PRIVACY_VERSION || "2026-05-29"
};

export const isProduction = config.env === "production";

export function assertSafeConfig() {
  if (isProduction) {
    const missing = [];
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) missing.push("SESSION_SECRET");
    if (!process.env.DATA_ENCRYPTION_KEY || process.env.DATA_ENCRYPTION_KEY.length < 32) missing.push("DATA_ENCRYPTION_KEY");
    if (!process.env.CORS_ORIGINS) missing.push("CORS_ORIGINS");
    if (config.aiProvider !== "mock" && (!config.aiApiUrl || !config.aiApiKey)) missing.push("AI_API_URL/AI_API_KEY");
    if (missing.length) {
      throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
    }
  }
}

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) continue;
    const rawValue = trimmed.slice(separator + 1).trim();
    process.env[key] = stripQuotes(rawValue);
  }
}

function stripQuotes(value) {
  if (value.length < 2) return value;
  const quote = value[0];
  return (quote === "\"" || quote === "'") && value.at(-1) === quote ? value.slice(1, -1) : value;
}
