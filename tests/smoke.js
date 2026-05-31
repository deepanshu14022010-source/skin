import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 4317;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "akrivo-skin-"));
const server = spawn(process.execPath, ["server/index.js"], {
  cwd: rootDir,
  env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, IMAGE_STORAGE_DIR: path.join(dataDir, "uploads"), SESSION_SECRET: "test-secret", AI_PROVIDER: "mock" },
  stdio: ["ignore", "pipe", "pipe"]
});

let cookies = "";
const cookieJar = new Map();
let csrfToken = "";

function waitForServer() {
  server.stdout.on("data", chunk => process.stdout.write(chunk));
  server.stderr.on("data", chunk => process.stderr.write(chunk));
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (response.ok) {
          clearInterval(timer);
          resolve();
        }
      } catch {
        if (Date.now() - startedAt > 15000) {
          clearInterval(timer);
          reject(new Error("Server did not start in time."));
        }
      }
    }, 250);
  });
}

async function request(pathname, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !csrfToken) {
    const csrf = await request("/api/auth/csrf");
    csrfToken = csrf.csrfToken;
  }
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(options.headers || {})
    }
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    for (const part of setCookie.split(/,(?=\s*[^;,]+=)/)) {
      const pair = part.trim().split(";")[0];
      const [name, ...value] = pair.split("=");
      cookieJar.set(name, value.join("="));
    }
    cookies = [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${pathname} failed: ${response.status} ${text}`);
  return body;
}

async function flow(email) {
  const auth = await request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password: "Password123!" })
  });
  if (!auth.user.id) throw new Error("Signup did not return a user.");

  await request("/api/onboarding", {
    method: "POST",
    body: JSON.stringify({
      name: "Test User",
      ageRange: "25-34",
      country: "India",
      skinType: "combination",
      concerns: ["acne", "pigmentation"],
      allergies: ["fragrance"],
      currentRoutine: "cleanser",
      budgetLevel: "medium",
      sensitivityLevel: "medium",
      redFlags: [],
      consentAccepted: true,
      guardianConsentAccepted: false,
      photoConsentAccepted: true,
      aiProcessingConsentAccepted: true,
      understandsWellnessOnly: true
    })
  });

  const upload = await request("/api/images/upload", {
    method: "POST",
    body: JSON.stringify({
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      uploadPurpose: "analysis",
      ownPhotoConsent: true,
      aiProcessingConsent: true,
      wellnessOnlyConsent: true
    })
  });

  const analysis = await request("/api/analysis/create", {
    method: "POST",
    body: JSON.stringify({ imageId: upload.image.id })
  });
  if (!analysis.aiOutput.disclaimer.includes("not a medical device")) throw new Error("AI disclaimer missing.");

  await request("/api/settings", {
    method: "PATCH",
    body: JSON.stringify({ remindersEnabled: true, morningTime: "07:30", nightTime: "21:15", stepDelayMinutes: 12, skipToday: false })
  });

  await request("/api/routine/step-complete", {
    method: "POST",
    body: JSON.stringify({ routineType: "morning", stepName: analysis.routine.morningSteps[0].stepName })
  });

  const progressUpload = await request("/api/images/upload", {
    method: "POST",
    body: JSON.stringify({
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      uploadPurpose: "progress",
      ownPhotoConsent: true,
      aiProcessingConsent: false,
      wellnessOnlyConsent: true
    })
  });

  await request("/api/progress/photo", {
    method: "POST",
    body: JSON.stringify({ imageId: progressUpload.image.id, notes: "Self-tracked progress note", concerns: ["acne"], visibility: "private" })
  });

  const me = await request("/api/auth/me");
  if (!me.user.latestRoutine || !me.user.progress.length) throw new Error("User summary missing routine or progress.");
  return me.user;
}

(async () => {
  try {
    await waitForServer();
    const userA = await flow("test@example.com");
    const duo = await request("/api/duo/create-code", { method: "POST" });
    if (!duo.user.duo.duoCode) throw new Error("Duo code missing.");

    cookies = "";
    cookieJar.clear();
    csrfToken = "";
    await flow("partner@example.com");
    const joined = await request("/api/duo/join", {
      method: "POST",
      body: JSON.stringify({ duoCode: duo.user.duo.duoCode })
    });
    if (!joined.user.duo.partner) throw new Error("Duo partner not visible.");

    console.log(`Smoke test passed for ${userA.email}.`);
  } finally {
    server.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => {
  server.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.error(error);
  process.exit(1);
});
