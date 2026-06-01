import { createCompletion, createRoutine } from "../models/factories.js";

export function createRoutineFromAi(db, userId, analysisId, aiOutput) {
  const routine = createRoutine(userId, {
    morningSteps: aiOutput.morningRoutine,
    nightSteps: aiOutput.nightRoutine,
    cautions: aiOutput.cautions,
    prepChecklist: aiOutput.prepChecklist,
    productRecommendations: aiOutput.productRecommendations,
    budgetRange: aiOutput.budgetRange,
    generatedFromAnalysisId: analysisId
  });
  db.routines[routine.id] = routine;
  db.skinAnalyses[analysisId].routineRecommendationId = routine.id;
  return routine;
}

export function latestRoutine(db, userId) {
  return Object.values(db.routines).filter(item => item.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
}

export function todayRoutine(db, userId) {
  const routine = latestRoutine(db, userId);
  const today = new Date().toISOString().slice(0, 10);
  const completions = Object.values(db.routineCompletions).filter(item => item.userId === userId && item.date === today);
  return { routine, date: today, completions };
}

export function markStep(db, userId, input, skipped = false) {
  const date = input.date || new Date().toISOString().slice(0, 10);
  const routineType = input.routineType;
  const id = `${userId}_${date}_${routineType}`;
  const current = db.routineCompletions[id] || createCompletion(userId, { date, routineType });
  const field = skipped ? "skippedSteps" : "stepsCompleted";
  current[field] = Array.from(new Set([...(current[field] || []), input.stepName]));
  const routine = latestRoutine(db, userId);
  const steps = routineType === "night" ? routine?.nightSteps || [] : routine?.morningSteps || [];
  const tracked = new Set([...(current.stepsCompleted || []), ...(current.skippedSteps || [])]);
  if (steps.length && steps.every(step => tracked.has(step.stepName))) current.completedAt = new Date().toISOString();
  current.updatedAt = new Date().toISOString();
  db.routineCompletions[id] = current;
  return current;
}
