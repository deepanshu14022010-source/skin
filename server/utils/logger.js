export function logSecurity(event, details = {}) {
  log("security", event, details);
}

export function logInfo(event, details = {}) {
  log("info", event, details);
}

export function logError(event, error, details = {}) {
  log("error", event, { ...details, message: error?.message, stack: process.env.NODE_ENV === "production" ? undefined : error?.stack });
}

function log(level, event, details) {
  const safeDetails = redact(details);
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, event, ...safeDetails }));
}

function redact(value) {
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (/password|token|secret|cookie|authorization|apiKey/i.test(key)) return [key, "[redacted]"];
    if (/email/i.test(key) && typeof entry === "string") return [key, maskEmail(entry)];
    if (/userId|ownerId/i.test(key) && typeof entry === "string") return [key, `${entry.slice(0, 7)}...`];
    return [key, entry && typeof entry === "object" ? redact(entry) : entry];
  }));
}

function maskEmail(email) {
  const [name, domain] = email.split("@");
  if (!domain) return "[redacted-email]";
  return `${name.slice(0, 2)}***@${domain}`;
}
