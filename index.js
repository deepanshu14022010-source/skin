import express from "express";
import fs from "node:fs";
import path from "node:path";
import { assertSafeConfig, config, isProduction } from "./config.js";
import { store } from "./db/localStore.js";
import { requireAuth } from "./middleware/auth.js";
import { aiLimiter, csrfRoute, requireCsrf, securityMiddleware, uploadLimiter } from "./middleware/security.js";
import { authRouter } from "./routes/auth.js";
import { onboardingRouter } from "./routes/onboarding.js";
import { imagesRouter } from "./routes/images.js";
import { analysisRouter } from "./routes/analysis.js";
import { routineRouter } from "./routes/routine.js";
import { progressRouter } from "./routes/progress.js";
import { duoRouter } from "./routes/duo.js";
import { settingsRouter } from "./routes/settings.js";
import { adminRouter } from "./routes/admin.js";
import { paymentsRouter } from "./routes/payments.js";
import { skinBotRouter } from "./routes/skinBot.js";
import { logError, logInfo } from "./utils/logger.js";
import { runRetentionCleanup } from "./services/retentionService.js";

const app = express();
assertSafeConfig();

securityMiddleware(app);
app.use(express.json({ limit: config.maxJsonBytes, strict: true }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "akrivo-skin" }));
app.get("/api/brand/logo", (_req, res) => {
  const logo = findLogo();
  if (!logo) return res.status(404).end();
  res.setHeader("Content-Type", logo.contentType);
  res.setHeader("Content-Disposition", "inline; filename=\"akrivo-logo\"");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.sendFile(logo.file);
});
store.transaction(db => runRetentionCleanup(db));
app.get("/api/auth/csrf", csrfRoute);
app.use("/api/auth", requireCsrf, authRouter);

app.use("/api", requireAuth, requireCsrf, (req, _res, next) => {
  req.persist = () => store.write(req.db);
  next();
});

for (const router of [onboardingRouter, routineRouter, progressRouter, duoRouter, settingsRouter, paymentsRouter, skinBotRouter, adminRouter]) {
  app.use("/api", (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = body => {
      if (req.db) store.write(req.db);
      return originalJson(body);
    };
    next();
  }, router);
}

app.use("/api", (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = body => {
    if (req.db) store.write(req.db);
    return originalJson(body);
  };
  next();
}, uploadLimiter, imagesRouter);

app.use("/api", (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = body => {
    if (req.db) store.write(req.db);
    return originalJson(body);
  };
  next();
}, aiLimiter, analysisRouter);

app.use(express.static(path.join(config.rootDir, "dist")));
app.use(express.static(path.join(config.rootDir, "public")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(config.rootDir, "dist", "index.html"), error => {
    if (error) res.sendFile(path.join(config.rootDir, "index.html"));
  });
});

app.use((error, req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    logError("malformed_json", error, { path: req.path });
    return res.status(400).json({ error: "Malformed JSON request body." });
  }
  const status = error.status || 500;
  logError("request_failed", error, { path: req.path, status });
  res.status(status).json({ error: status >= 500 && isProduction ? "Something went wrong." : status >= 500 ? error.message : error.message });
});

app.listen(config.port, config.host, () => {
  logInfo("server_started", { url: `http://${config.host}:${config.port}` });
  console.log(`AKRIVO Skin API running at http://${config.host}:${config.port}`);
});

function findLogo() {
  const candidates = [];
  const ignored = new Set(["node_modules", "dist", "data", ".git"]);
  walk(config.rootDir);
  return candidates
    .map(file => ({ file, size: fs.statSync(file).size, name: path.basename(file).toLowerCase(), detected: detectImage(file) }))
    .filter(item => item.detected)
    .sort((a, b) => logoScore(b) - logoScore(a))[0]?.detected || null;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) walk(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) candidates.push(path.join(dir, entry.name));
    }
  }
}

function detectImage(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { file, contentType: "image/png" };
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { file, contentType: "image/jpeg" };
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return { file, contentType: "image/webp" };
  return null;
}

function logoScore(item) {
  let score = item.size;
  if (item.name.includes("akrivo")) score += 10_000_000;
  if (item.name.includes("logo")) score += 10_000_000;
  if (item.name.includes("skin")) score += 2_000_000;
  return score;
}
