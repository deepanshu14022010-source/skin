# AI Output Contract

AI calls must happen on the backend only. API keys must stay in environment variables and must never be exposed to the React app.

The analysis service must return JSON only:

```json
{
  "skinTypeEstimate": "",
  "visibleConcerns": [
    {
      "concern": "",
      "confidence": "likely | possible | not clearly visible",
      "explanation": ""
    }
  ],
  "redFlags": [],
  "morningRoutine": [],
  "nightRoutine": [],
  "productCategories": [],
  "cautions": [],
  "disclaimer": ""
}
```

Rules:

- Do not diagnose.
- Do not prescribe.
- Do not guarantee results.
- Do not identify the person.
- Do not judge attractiveness.
- Do not shame appearance.
- Only analyze skincare-related visible patterns.
- Always include uncertainty.
- Always include the AKRIVO Skin disclaimer.
