import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";

const dbPath = path.join(config.dataDir, "db.json");

const emptyDb = () => ({
  users: {},
  sessions: {},
  skinProfiles: {},
  skinAnalyses: {},
  routines: {},
  routineCompletions: {},
  progressPhotos: {},
  duoConnections: {},
  imageAssets: {},
  settings: {},
  auditLogs: {},
  breachEvents: {},
  payments: {},
  emailOtps: {},
  otpRequestLimits: {}
});

export class LocalStore {
  constructor() {
    fs.mkdirSync(config.dataDir, { recursive: true });
    if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify(emptyDb(), null, 2));
  }

  read() {
    const raw = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    const data = raw.encrypted ? decryptDb(raw) : raw;
    return { ...emptyDb(), ...data };
  }

  write(db) {
    const payload = { ...emptyDb(), ...db };
    fs.writeFileSync(dbPath, JSON.stringify(config.dataEncryptionKey ? encryptDb(payload) : payload, null, 2));
  }

  transaction(mutator) {
    const db = this.read();
    const result = mutator(db);
    this.write(db);
    return result;
  }
}

export const store = new LocalStore();

function encryptionKey() {
  return crypto.createHash("sha256").update(config.dataEncryptionKey).digest();
}

function encryptDb(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return {
    encrypted: true,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64")
  };
}

function decryptDb(payload) {
  if (!config.dataEncryptionKey) throw new Error("DATA_ENCRYPTION_KEY is required to read encrypted local data.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
