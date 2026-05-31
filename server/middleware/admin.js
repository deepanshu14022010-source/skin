import { apiError } from "../utils/http.js";
import { audit } from "../services/auditService.js";

export function requireAdmin(req, _res, next) {
  if (req.user.role !== "admin") return next(apiError("Admin access required.", 403));
  audit(req.db, req.user.id, "admin_access", { path: req.path });
  return next();
}
