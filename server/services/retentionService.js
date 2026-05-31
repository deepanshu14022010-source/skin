import { audit } from "./auditService.js";

const retentionDays = {
  skinAnalyses: 365,
  progressPhotos: 730,
  routineCompletions: 730,
  imageAssets: 730,
  auditLogs: 1095,
  breachEvents: 1825
};

export function runRetentionCleanup(db) {
  const now = Date.now();
  let deleted = 0;
  for (const [collection, days] of Object.entries(retentionDays)) {
    for (const [key, record] of Object.entries(db[collection] || {})) {
      const created = Date.parse(record.createdAt || record.updatedAt || 0);
      if (created && now - created > days * 24 * 60 * 60 * 1000) {
        delete db[collection][key];
        deleted += 1;
      }
    }
  }
  if (deleted) audit(db, "system", "retention_cleanup", { deleted });
  return { deleted, retentionDays };
}

export function retentionPolicy() {
  return retentionDays;
}
