import { z } from "zod";
import { apiError } from "./http.js";

export const idSchema = z.string().regex(/^[a-z]{3}_[0-9a-f-]{36}$/i, "Invalid id.");
export const emailSchema = z.string().email().max(254).transform(value => value.toLowerCase().trim());
export const passwordSchema = z.string().min(12).max(128)
  .regex(/[a-z]/, "Password must include lowercase.")
  .regex(/[A-Z]/, "Password must include uppercase.")
  .regex(/[0-9]/, "Password must include a number.")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol.");

export const authSchema = z.object({
  email: emailSchema,
  password: passwordSchema
}).strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();
export const otpRequestSchema = z.object({ email: emailSchema }).strict();
export const otpVerifySchema = z.object({
  email: emailSchema,
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit verification code.")
}).strict();
export const signupVerifySchema = otpVerifySchema;
export const passwordResetSchema = z.object({
  email: emailSchema,
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit verification code."),
  password: passwordSchema
}).strict();

export const onboardingSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ageRange: z.string().max(20),
  country: z.string().trim().max(80).optional().default(""),
  skinType: z.enum(["unknown", "oily", "dry", "combination", "sensitive", "normal"]).default("unknown"),
  concerns: z.array(z.string().max(40)).max(15).default([]),
  allergies: z.union([z.array(z.string().max(80)), z.string().max(400)]).optional().default([]),
  currentRoutine: z.string().max(700).optional().default(""),
  budgetLevel: z.enum(["300-500", "600-1000", "1000-2500", "2500-5000", "low", "medium", "high"]).default("600-1000"),
  sensitivityLevel: z.enum(["unknown", "low", "medium", "high"]).default("unknown"),
  redFlags: z.array(z.string().max(80)).max(12).default([]),
  consentAccepted: z.literal(true),
  guardianConsentAccepted: z.boolean().optional().default(false),
  photoConsentAccepted: z.boolean().optional().default(false),
  aiProcessingConsentAccepted: z.boolean().optional().default(false),
  understandsWellnessOnly: z.boolean().optional().default(false)
}).strict();

export const skinBotSchema = z.object({
  message: z.string().trim().min(2).max(1200),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(1200)
  }).strict()).max(8).optional().default([])
}).strict();

export const imageUploadSchema = z.object({
  dataUrl: z.string().max(6_500_000),
  uploadPurpose: z.enum(["analysis", "progress"]).default("analysis"),
  ownPhotoConsent: z.literal(true),
  aiProcessingConsent: z.boolean().optional().default(false),
  wellnessOnlyConsent: z.literal(true)
}).strict();

export const analysisCreateSchema = z.object({
  imageId: idSchema,
  questionnaireData: z.record(z.unknown()).optional()
}).strict();

export const routineStepSchema = z.object({
  routineType: z.enum(["morning", "night"]),
  stepName: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}).strict();

export const settingsSchema = z.object({
  remindersEnabled: z.boolean().optional(),
  morningTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  nightTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  stepDelayMinutes: z.coerce.number().int().min(1).max(60).optional(),
  skipToday: z.boolean().optional()
}).strict();

export const progressSchema = z.object({
  imageId: idSchema,
  notes: z.string().max(700).optional().default(""),
  concerns: z.array(z.string().max(40)).max(15).default([]),
  visibility: z.enum(["private", "shared"]).default("private")
}).strict();

export const duoJoinSchema = z.object({
  duoCode: z.string().trim().regex(/^[A-Z0-9]{6,8}$/i).optional(),
  code: z.string().trim().regex(/^[A-Z0-9]{6,8}$/i).optional()
}).strict();

export const duoPrivacySchema = z.object({
  shareRoutineStatus: z.boolean().default(true),
  shareStreak: z.boolean().default(true),
  shareProgressNotes: z.boolean().default(false),
  sharePhotos: z.literal(false).optional()
}).strict();

export const abuseReportSchema = z.object({
  category: z.enum(["privacy", "abuse", "security", "incorrect-ai", "other"]).default("other"),
  message: z.string().trim().min(5).max(1000)
}).strict();

export const accountCorrectionSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  ageRange: z.string().max(20).optional(),
  country: z.string().trim().max(80).optional()
}).strict();

export const breachReportSchema = z.object({
  category: z.enum(["suspected-breach", "unauthorized-access", "data-exposure", "other"]).default("suspected-breach"),
  summary: z.string().trim().min(10).max(1200)
}).strict();

export function validate(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw apiError(result.error.issues.map(issue => issue.message).join(" "), 400);
  }
  return result.data;
}
