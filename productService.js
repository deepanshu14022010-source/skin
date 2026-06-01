const budgetRanges = {
  low: { label: "Rs 300-500", min: 300, max: 500 },
  medium: { label: "Rs 600-1000", min: 600, max: 1000 },
  high: { label: "Rs 1000-2500", min: 1000, max: 2500 },
  "300-500": { label: "Rs 300-500", min: 300, max: 500 },
  "600-1000": { label: "Rs 600-1000", min: 600, max: 1000 },
  "1000-2500": { label: "Rs 1000-2500", min: 1000, max: 2500 },
  "2500-5000": { label: "Rs 2500-5000", min: 2500, max: 5000 }
};

const unsafeTerms = [
  "mercury",
  "hydroquinone",
  "clobetasol",
  "betamethasone",
  "tretinoin",
  "isotretinoin",
  "skin whitening injection",
  "bleaching cream"
];

const catalog = [
  product("Cleanser", "Simple Kind To Skin Refreshing Facial Wash", "gentle gel cleanser, soap-free, no added fragrance", ["normal", "combination", "sensitive", "oily"], ["300-500", "600-1000"], [], 385),
  product("Cleanser", "Cetaphil Gentle Skin Cleanser", "non-stripping cleanser for dry or sensitive skin", ["dry", "sensitive", "normal"], ["300-500", "600-1000", "1000-2500"], ["dry skin", "redness"], 399),
  product("Cleanser", "Minimalist 2% Salicylic Acid Cleanser", "salicylic-acid cleanser for oily, acne-prone skin", ["oily", "combination"], ["300-500", "600-1000"], ["acne", "pimples", "blackheads", "pores"], 299, 16),
  product("Cleanser", "Mamaearth Ubtan Face Wash", "turmeric and saffron face wash for dullness; patch test if sensitive", ["normal", "combination", "oily"], ["300-500"], ["dullness", "uneven tone"], 259),
  product("Moisturizer", "Pond's Super Light Gel Oil Free Moisturiser", "light gel moisturizer with hyaluronic acid and vitamin E", ["oily", "combination", "normal"], ["300-500", "600-1000"], [], 299),
  product("Moisturizer", "Re'equil Ceramide & Hyaluronic Acid Moisturiser", "barrier-support moisturizer for dry or sensitive skin", ["dry", "sensitive", "normal"], ["600-1000", "1000-2500"], ["dry skin", "redness"], 395),
  product("Moisturizer", "Bioderma Atoderm Creme Ultra", "richer moisturizer for dry, tight-feeling skin", ["dry", "sensitive"], ["1000-2500", "2500-5000"], ["dry skin"], 799),
  product("Sunscreen", "Fixderma Shadow SPF 50+ Gel", "broad-spectrum gel sunscreen for oily or combination skin", ["oily", "combination", "normal"], ["300-500", "600-1000"], ["pigmentation", "dark spots"], 395),
  product("Sunscreen", "Minimalist SPF 50 PA++++ Sunscreen", "broad-spectrum daily sunscreen with lightweight finish", ["normal", "combination", "oily"], ["300-500", "600-1000"], ["pigmentation", "dark spots", "uneven tone"], 399),
  product("Sunscreen", "Re'equil Ultra Matte Dry Touch Sunscreen Gel SPF 50 PA++++", "matte sunscreen for oily or humid-day use", ["oily", "combination"], ["600-1000", "1000-2500"], ["pigmentation", "dark spots"], 780),
  product("Serum", "Minimalist 5% Niacinamide Serum", "beginner-friendly niacinamide for oil balance and marks", ["oily", "combination", "normal", "sensitive"], ["300-500", "600-1000"], ["pigmentation", "dark spots", "pores", "oily skin"], 599),
  product("Serum", "Deconstruct 10% Niacinamide + 0.3% Alpha Arbutin Serum", "tone-support serum for dark spots; introduce slowly", ["normal", "combination", "oily"], ["600-1000", "1000-2500"], ["pigmentation", "dark spots", "uneven tone"], 699, 16),
  product("Treatment", "Sebogel Salicylic Acid & Nicotinamide Gel", "targeted acne-support gel; use only a few nights weekly", ["oily", "combination"], ["300-500"], ["acne", "pimples", "blackheads"], 220, 16),
  product("Treatment", "Benzac AC 2.5% Gel", "benzoyl peroxide acne spot support; can bleach fabric and irritate", ["oily", "combination"], ["300-500", "600-1000"], ["acne", "pimples"], 160, 16),
  product("Barrier", "CeraVe Moisturising Cream", "ceramide-rich moisturizer for dry barrier support", ["dry", "sensitive", "normal"], ["1000-2500", "2500-5000"], ["dry skin", "redness"], 1500)
];

export function buildProductPlan(profile = {}) {
  const budgetRange = budgetRanges[profile.budgetLevel] || budgetRanges["600-1000"];
  const skinType = profile.skinType || "unknown";
  const concerns = new Set(profile.concerns || []);
  const age = minimumAge(profile.ageRange);
  const country = String(profile.country || "India");
  const selected = [];

  for (const category of ["Cleanser", "Moisturizer", "Sunscreen", recommendedTreatmentCategory(concerns)]) {
    const candidates = catalog
      .filter(item => item.category === category)
      .filter(item => item.price >= budgetRange.min && item.price <= budgetRange.max)
      .filter(item => item.minAge <= age)
      .filter(item => item.skinTypes.includes(skinType) || item.skinTypes.includes("normal") || skinType === "unknown")
      .filter(item => item.countries.includes(country) || item.countries.includes("India"))
      .filter(item => isSafeProduct(item))
      .sort((a, b) => scoreProduct(b, skinType, concerns) - scoreProduct(a, skinType, concerns));
    if (candidates[0]) selected.push(candidates[0]);
  }

  const unique = [...new Map(selected.map(item => [item.name, item])).values()];
  return {
    budgetRange,
    productRecommendations: unique.map(item => ({
      category: item.category,
      name: item.name,
      why: item.why,
      estimatedPrice: `Around Rs ${item.price}`,
      budgetRange: budgetRange.label,
      buyUrl: duckDuckGoUrl(`${item.name} ${item.category} India price`),
      safetyNote: safetyNote(item, profile)
    })),
    prepChecklist: buildPrepChecklist(unique, budgetRange)
  };
}

export function safetyGuardrails(country = "India") {
  return [
    `For ${country}, avoid products marketed as bleaching/whitening cures or products without a full ingredient label.`,
    "Avoid mercury, hydroquinone, clobetasol/betamethasone steroid mixes, tretinoin/isotretinoin, peels, and injections unless prescribed by a qualified clinician.",
    "Use sunscreen SPF 30+ in the morning. Patch test new products for 24-48 hours."
  ];
}

function product(category, name, why, skinTypes, budgets, concerns = [], price = 500, minAge = 13, countries = ["India"]) {
  return { category, name, why, skinTypes, budgets, concerns, price, minAge, countries };
}

function recommendedTreatmentCategory(concerns) {
  if (concerns.has("acne") || concerns.has("pimples") || concerns.has("blackheads")) return "Treatment";
  if (concerns.has("pigmentation") || concerns.has("dark spots") || concerns.has("uneven tone") || concerns.has("pores") || concerns.has("oily skin")) return "Serum";
  return "Barrier";
}

function minimumAge(ageRange = "") {
  const match = String(ageRange).match(/\d+/);
  return match ? Number(match[0]) : 18;
}

function isSafeProduct(item) {
  const text = `${item.name} ${item.why}`.toLowerCase();
  return unsafeTerms.every(term => !text.includes(term));
}

function scoreProduct(item, skinType, concerns) {
  let score = item.skinTypes.includes(skinType) ? 10 : 0;
  for (const concern of item.concerns) if (concerns.has(concern)) score += 4;
  if (item.category === "Sunscreen") score += 2;
  return score;
}

function buildPrepChecklist(products, budgetRange) {
  return [
    `Set aside ${budgetRange.label} for the starter kit.`,
    ...products.map(item => `Buy or keep ready: ${item.name} (${item.category}, about Rs ${item.price}).`),
    "Take a clear baseline photo in natural light.",
    "Patch test new leave-on products before full-face use.",
    "Start the full routine tomorrow morning, not tonight, so irritation can be tracked cleanly."
  ];
}

function safetyNote(item, profile) {
  if (item.minAge >= 16 && minimumAge(profile.ageRange) < 16) return "Skip for younger teens unless a parent/guardian and clinician agree.";
  if (profile.sensitivityLevel === "high" || profile.skinType === "sensitive") return "Patch test carefully and start every other day if it is a treatment.";
  return "OTC cosmetic-style pick; check the current label before purchase.";
}

function duckDuckGoUrl(query) {
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}
