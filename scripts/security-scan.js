import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirs = new Set(["node_modules", "dist", "data", ".git"]);
const ignoredFiles = new Set(["package-lock.json"]);
const patterns = [
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  /mongodb(?:\+srv)?:\/\/[^\s"']+/i,
  /postgres(?:ql)?:\/\/[^\s"']+/i,
  /sk-[A-Za-z0-9]{20,}/,
  /(api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{12,}["']/i
];

const allowed = [
  ".env.example",
  "SECURITY.md",
  "README.md",
  "server/config.js",
  "server/utils/logger.js",
  "server/utils/validation.js",
  "server/utils/crypto.js",
  "scripts/security-scan.js"
];

const findings = [];
walk(root);

if (findings.length) {
  console.error("Potential hardcoded secret findings:");
  for (const finding of findings) console.error(`${finding.file}:${finding.line}: ${finding.text}`);
  process.exit(1);
}

console.log("Security scan passed: no likely hardcoded secrets found.");

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(path.join(dir, entry.name));
      continue;
    }
    if (!entry.isFile() || ignoredFiles.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (!/\.(js|jsx|json|md|sql|example|env|yml|yaml|toml)$/i.test(rel)) continue;
    const text = fs.readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line, index) => {
      if (allowed.includes(rel)) return;
      if (patterns.some(pattern => pattern.test(line))) findings.push({ file: rel, line: index + 1, text: line.trim().slice(0, 180) });
    });
  }
}
