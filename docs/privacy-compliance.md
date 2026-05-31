# AKRIVO Skin DPDP Act Compliance Notes

This document explains how AKRIVO Skin supports privacy safeguards for Indian users under India’s Digital Personal Data Protection Act principles. This is an engineering compliance map, not legal advice.

## Consent

AKRIVO Skin requires clear consent before personal data collection and photo/AI processing:

- The user accepts the privacy notice.
- The user confirms they are uploading their own photo or have permission.
- The user agrees that the photo may be processed for skin wellness insights.
- The user understands AKRIVO Skin is not medical advice.
- Teen users in the `13-17` age range must confirm parent or guardian consent where required.

Consent is stored on the user record with privacy version acceptance.

## Consent Withdrawal

Users can withdraw consent from Settings. Withdrawal sets `processingRestricted=true` and blocks new photo uploads, AI analysis, and routine generation.

The account remains accessible so the user can export, correct, or delete data.

## Data Access and Correction

Users can export stored user data from Settings, correct account details, and update skin profile details through protected profile endpoints. Exports redact private storage paths.

## Data Deletion

Users can delete individual progress entries, delete analysis history and generated routines, delete progress timeline data, and delete the entire account with local associated records.

## Data Minimization

AKRIVO Skin does not collect phone numbers, contacts, microphone access, government IDs, Aadhaar, PAN, payment data, SMS identifiers, WhatsApp identifiers, or precise location in this MVP.

Photo input is user-initiated. The app does not request unnecessary device permissions.

## Retention

Automatic retention cleanup runs on server startup:

- Skin analyses: 365 days.
- Progress photos: 730 days.
- Routine completions: 730 days.
- Image assets: 730 days.
- Audit logs: 1095 days.
- Breach events: 1825 days.

Users can delete data sooner through Settings.

## Third-Party Processors

Potential processors must be listed before production use: AI APIs, private cloud object storage, email/support tooling, analytics, payment gateways, and push notification services.

Only data necessary for the requested function should be sent to a processor. API keys and processor credentials must remain backend-only environment variables.

## Security Controls

Implemented safeguards include HTTPS enforcement in production, secure HttpOnly SameSite cookies, CSRF protection, bcrypt password hashing, rate limiting, CORS allowlist, Helmet security headers, environment variables for secrets, optional AES-256-GCM local database encryption with `DATA_ENCRYPTION_KEY`, zero-trust image validation, private upload storage, and structured audit/security logs with sensitive values masked.

## Admin Privacy Safeguards

Admin routes require `role=admin`. Admin user lists are masked, private photos are not exposed, and admin access is logged.

## Breach Handling

Users can report suspected data breaches from Settings. The backend creates a breach event with status `triage` and an audit log entry.

Production operations should add monitored security inboxes, incident severity classification, affected-user identification, notification records, required authority/user notifications under applicable DPDP rules, and remediation tracking.

## Children and Teens

AKRIVO Skin asks for age range. For users under 18, the app requires parent/guardian consent where applicable. The app must not target children with behavioral ads, manipulative profiling, harmful content, attractiveness scoring, or unrealistic comparisons.

## MITM Protection

Production deployments must use HTTPS/TLS for all traffic, redirect HTTP to HTTPS, and keep secure cookies enabled. Future mobile apps should use SSL certificate pinning where appropriate.
