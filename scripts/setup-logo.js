import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const target = path.join(publicDir, "akrivo-logo.png");
const imageExts = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const ignoredDirs = new Set(["node_modules", "dist", "data", ".git"]);

fs.mkdirSync(publicDir, { recursive: true });

const candidates = [];
walk(root);

const existing = candidates.find(file => path.resolve(file) === path.resolve(target));
if (existing) {
  console.log("Logo already exists at public/akrivo-logo.png");
  process.exit(0);
}

const likely = candidates
  .filter(file => !file.includes(`${path.sep}public${path.sep}`))
  .map(file => ({ file, size: fs.statSync(file).size, name: path.basename(file).toLowerCase() }))
  .sort((a, b) => score(b) - score(a))[0];

if (!likely) {
  console.error("No logo image found. Place a PNG/JPG/WEBP in the project folder, then run npm run logo:setup.");
  process.exit(1);
}

fs.copyFileSync(likely.file, target);
console.log(`Copied logo: ${path.relative(root, likely.file)} -> public/akrivo-logo.png`);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(path.join(dir, entry.name));
      continue;
    }
    if (!entry.isFile()) continue;
    const file = path.join(dir, entry.name);
    if (imageExts.has(path.extname(entry.name).toLowerCase())) candidates.push(file);
  }
}

function score(candidate) {
  let value = candidate.size;
  if (candidate.name.includes("logo")) value += 10_000_000;
  if (candidate.name.includes("akrivo")) value += 10_000_000;
  if (candidate.name.includes("skin")) value += 2_000_000;
  return value;
}
