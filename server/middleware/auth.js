import { store } from "../db/localStore.js";
import { authFromRequest, serializeUser } from "../services/authService.js";
import { apiError } from "../utils/http.js";

export function requireAuth(req, res, next) {
  const db = store.read();
  const auth = authFromRequest(db, req);
  if (!auth) return next(apiError("Not signed in.", 401));
  req.db = db;
  req.auth = auth;
  req.user = auth.user;
  req.currentUser = serializeUser(db, auth.user);
  return next();
}
