import { DISCLAIMER, FOOTER_DISCLAIMER, RED_FLAG_OPTIONS } from "../constants.js";
import { config } from "../config.js";

export async function analyzeSkin({ imageAsset, questionnaireData }) {
  if (config.aiProvider !== "mock" && config.aiApiKey && config.aiApiUrl) {
    return callExternalAi({ imageAsset, questionnaireData });
  }
  return mockStructuredAnalysis({ questionnaireData });
}

async function callExternalAi({ questionnaireData }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(config.aiApiUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.aiApiKey}`
      },
      body: JSON.stringify({
        model: config.aiModel,
        instructions: [
          "Return JSON only using the provided AKRIVO Skin schema.",
        "Do not provide medical conclusions, prescribe, promise outcomes, identify the person, judge attractiveness, or shame appearance.",
          "Only analyze skincare-related visible patterns. Always include uncertainty and the exact disclaimer."
        ].join(" "),
        schema: {
          skinTypeEstimate: "string",
          visibleConcerns: [{ concern: "string", confidence: "likely | possible | not clearly visible", explanation: "string" }],
          redFlags: ["string"],
          morningRoutine: [{ stepName: "string", instruction: "string", estimatedDuration: "string", warning: "string" }],
          nightRoutine: [{ stepName: "string", instruction: "string", estimatedDuration: "string", warning: "string" }],
          productCategories: ["string"],
          cautions: ["string"],
          disclaimer: DISCLAIMER
        },
        questionnaireData
      })
    });
    if (!response.ok) return mockStructuredAnalysis({ questionnaireData, providerNote: "External AI call failed; local safety fallback was used." });
    const output = await response.json();
    return validateAiOutput(output) ? output : mockStructuredAnalysis({ questionnaireData, providerNote: "External AI response did not match the required schema; local safety fallback was used." });
  } catch {
    return mockStructuredAnalysis({ questionnaireData, providerNote: "External AI timed out or failed; local safety fallback was used." });
  } finally {
    clearTimeout(timeout);
  }
}

function validateAiOutput(output) {
  return output
    && typeof output.skinTypeEstimate === "string"
    && Array.isArray(output.visibleConcerns)
    && Array.isArray(output.redFlags)
    && Array.isArray(output.morningRoutine)
    && Array.isArray(output.nightRoutine)
    && Array.isArray(output.productCategories)
    && Array.isArray(output.cautions)
    && typeof output.disclaimer === "string"
    && output.disclaimer.includes("does not diagnose");
}

function mockStructuredAnalysis({ questionnaireData, providerNote = "" }) {
  const concerns = new Set(questionnaireData?.concerns || []);
  const sensitive = questionnaireData?.skinType === "sensitive" || String(questionnaireData?.allergies || "").toLowerCase().includes("fragrance");
  const redFlags = (questionnaireData?.redFlags || []).filter(flag => RED_FLAG_OPTIONS.includes(flag));
  const visibleConcerns = [
    concernItem("Acne or pimples", concerns.has("acne") || concerns.has("pimples") || concerns.has("blackheads"), concerns.has("blackheads")),
    concernItem("Dark spots or pigmentation", concerns.has("pigmentation") || concerns.has("dark spots"), concerns.has("uneven tone")),
    concernItem("Redness", concerns.has("redness"), sensitive),
    concernItem("Dryness or flakiness", concerns.has("dry skin"), questionnaireData?.skinType === "dry"),
    concernItem("Oily appearance", concerns.has("oily skin"), questionnaireData?.skinType === "oily"),
    concernItem("Visible pores", concerns.has("pores"), concerns.has("oily skin")),
    concernItem("Uneven skin tone", concerns.has("uneven tone"), concerns.has("dullness"))
  ];
  const acneProne = visibleConcerns.some(item => item.concern.includes("Acne") && item.confidence !== "not clearly visible");
  const pigmentation = visibleConcerns.some(item => item.concern.includes("pigmentation") && item.confidence !== "not clearly visible");

  return {
    skinTypeEstimate: questionnaireData?.skinType && questionnaireData.skinType !== "unknown" ? `likely ${questionnaireData.skinType}` : "not clearly visible",
    visibleConcerns,
    redFlags,
    morningRoutine: [
      routineStep("Cleanser", "Use a gentle cleanser or rinse if skin feels dry.", "1 min"),
      routineStep(pigmentation ? "Niacinamide serum" : "Hydrating serum", "Optional thin layer if your skin tolerates it.", "1 min", sensitive ? "Patch test first." : ""),
      routineStep("Moisturizer", "Apply a light, non-comedogenic moisturizer.", "1 min"),
      routineStep("Sunscreen", "Use broad-spectrum SPF 30+ every morning.", "2 min", "Important for pigmentation and acne marks.")
    ],
    nightRoutine: [
      routineStep("Cleanser", "Cleanse to remove sunscreen and daily buildup.", "1 min"),
      acneProne ? routineStep("Acne-support step", "Consider salicylic acid 2-3 nights weekly, introduced slowly.", "1 min", "Avoid if very sensitive unless patch tested.") : routineStep("Hydration", "Use a simple hydrating serum or skip treatment.", "1 min"),
      routineStep("Moisturizer", "Finish with moisturizer. Use a richer layer if skin feels tight.", "1 min")
    ],
    productCategories: [
      "Gentle cleanser",
      "Non-comedogenic moisturizer",
      "Broad-spectrum sunscreen SPF 30+",
      pigmentation ? "Niacinamide serum" : "Hydrating serum",
      acneProne ? "Salicylic acid product used cautiously" : "Barrier-support cream"
    ],
    cautions: [
      "Do not combine multiple harsh actives in the same routine.",
      "Patch test new products for 24-48 hours.",
      "Stop use and consider consulting a dermatologist for severe burning, swelling, or fast worsening irritation.",
      "Patch test new products. Results vary.",
      providerNote
    ].filter(Boolean),
    disclaimer: `${DISCLAIMER} ${FOOTER_DISCLAIMER}`
  };
}

function concernItem(concern, strong, weak) {
  return {
    concern,
    confidence: strong ? "likely" : weak ? "possible" : "not clearly visible",
    explanation: strong
      ? "This visible skin concern estimate is suggested by your questionnaire and visible-pattern context."
      : weak
        ? "There is some context for this, but it is uncertain."
        : "This was not clearly visible from the available inputs."
  };
}

function routineStep(name, instruction, estimatedDuration, warning = "") {
  return { stepName: name, instruction, estimatedDuration, warning };
}
