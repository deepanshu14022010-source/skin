import crypto from "node:crypto";
import { config } from "../config.js";
import { id } from "../utils/crypto.js";
import { apiError } from "../utils/http.js";

const plans = {
  starter: {
    id: "starter",
    name: "AKRIVO Skin Starter",
    amount: 9900,
    currency: "INR",
    description: "Test mode monthly skincare wellness plan"
  }
};

export function listPlans() {
  return Object.values(plans);
}

export async function createRazorpayOrder(db, userId, planId = "starter") {
  const plan = plans[planId];
  if (!plan) throw apiError("Plan not found.", 404);
  const receipt = `akrivo_${Date.now()}_${userId.slice(0, 8)}`;
  const localPayment = {
    id: id("pay_"),
    userId,
    provider: "razorpay",
    mode: config.razorpayTestMode ? "test" : "live",
    planId: plan.id,
    amount: plan.amount,
    currency: plan.currency,
    status: "created",
    receipt,
    providerOrderId: null,
    providerPaymentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (config.razorpayKeyId && config.razorpayKeySecret) {
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString("base64")}`
      },
      body: JSON.stringify({
        amount: plan.amount,
        currency: plan.currency,
        receipt,
        notes: {
          localPaymentId: localPayment.id,
          userId
        }
      })
    });
    if (!response.ok) throw apiError("Could not create Razorpay order.", 502);
    const order = await response.json();
    localPayment.providerOrderId = order.id;
    localPayment.providerResponse = { id: order.id, status: order.status };
  } else {
    localPayment.providerOrderId = `order_test_${localPayment.id}`;
    localPayment.providerResponse = { id: localPayment.providerOrderId, status: "created", mock: true };
  }

  db.payments[localPayment.id] = localPayment;
  return {
    payment: localPayment,
    checkout: {
      key: config.razorpayKeyId || "rzp_test_mock_only",
      amount: plan.amount,
      currency: plan.currency,
      name: "AKRIVO Skin",
      description: plan.description,
      order_id: localPayment.providerOrderId,
      localPaymentId: localPayment.id,
      testMode: localPayment.mode === "test",
      mock: !config.razorpayKeyId || !config.razorpayKeySecret
    }
  };
}

export function verifyRazorpayPayment(db, userId, input) {
  const payment = db.payments[input.localPaymentId];
  if (!payment || payment.userId !== userId) throw apiError("Payment record not found.", 404);
  if (payment.providerOrderId !== input.razorpay_order_id) throw apiError("Payment order mismatch.", 400);

  if (payment.providerResponse?.mock) {
    payment.status = "test_verified";
  } else {
    const expected = crypto
      .createHmac("sha256", config.razorpayKeySecret)
      .update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`)
      .digest("hex");
    if (expected !== input.razorpay_signature) throw apiError("Payment signature verification failed.", 400);
    payment.status = "paid";
  }

  payment.providerPaymentId = input.razorpay_payment_id || "mock_payment";
  payment.updatedAt = new Date().toISOString();
  db.payments[payment.id] = payment;
  return payment;
}
