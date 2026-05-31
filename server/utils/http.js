export function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function cookieValue(req, name) {
  const raw = req.headers.cookie || "";
  const match = raw.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export function sanitizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function requireEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw apiError("Enter a valid email address.", 400);
}

export function requirePassword(password) {
  const value = String(password || "");
  if (value.length < 12) throw apiError("Password must be at least 12 characters.", 400);
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw apiError("Password must include uppercase, lowercase, number, and symbol.", 400);
  }
}

export function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

export function sanitizeString(value, max = 500) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}
