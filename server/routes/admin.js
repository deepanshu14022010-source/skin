import express from "express";
import { requireAdmin } from "../middleware/admin.js";
import { audit } from "../services/auditService.js";
import { asyncHandler } from "../utils/http.js";

export const adminRouter = express.Router();

adminRouter.get("/admin/users", requireAdmin, asyncHandler(async (req, res) => {
  audit(req.db, req.user.id, "admin_list_users");
  const users = Object.values(req.db.users).map(user => ({
    id: `${user.id.slice(0, 7)}...`,
    email: maskEmail(user.email),
    createdAt: user.createdAt,
    consentAccepted: Boolean(user.consentAccepted),
    processingRestricted: Boolean(user.processingRestricted)
  }));
  res.json({ users });
}));

adminRouter.get("/admin/audit-logs", requireAdmin, asyncHandler(async (req, res) => {
  audit(req.db, req.user.id, "admin_view_audit_logs");
  res.json({ auditLogs: Object.values(req.db.auditLogs).slice(-200) });
}));

adminRouter.get("/admin/breach-events", requireAdmin, asyncHandler(async (req, res) => {
  audit(req.db, req.user.id, "admin_view_breach_events");
  res.json({ breachEvents: Object.values(req.db.breachEvents).slice(-100) });
}));

function maskEmail(email) {
  const [name, domain] = String(email || "").split("@");
  return domain ? `${name.slice(0, 2)}***@${domain}` : "[redacted]";
}
