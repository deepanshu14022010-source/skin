import express from "express";
import { audit } from "../services/auditService.js";
import { createRazorpayOrder, listPlans, verifyRazorpayPayment } from "../services/paymentService.js";
import { asyncHandler } from "../utils/http.js";

export const paymentsRouter = express.Router();

paymentsRouter.get("/payments/plans", asyncHandler(async (_req, res) => {
  res.json({ provider: "razorpay", plans: listPlans() });
}));

paymentsRouter.post("/payments/razorpay/order", asyncHandler(async (req, res) => {
  const result = await createRazorpayOrder(req.db, req.user.id, req.body.planId || "starter");
  audit(req.db, req.user.id, "razorpay_order_created", { paymentId: result.payment.id, planId: result.payment.planId });
  res.status(201).json(result);
}));

paymentsRouter.post("/payments/razorpay/verify", asyncHandler(async (req, res) => {
  const payment = verifyRazorpayPayment(req.db, req.user.id, req.body);
  audit(req.db, req.user.id, "razorpay_payment_verified", { paymentId: payment.id, status: payment.status });
  res.json({ payment });
}));
