# AKRIVO Skin Security Posture

## Implemented Controls

- HttpOnly signed cookie sessions with server-side invalidation.
- CSRF token protection for mutating cookie-authenticated requests.
- Strong password rules and bcrypt hashing.
- Failed-login throttling: 5 failed attempts per 15 minutes per IP/email key.
- Global, upload, and AI-analysis rate limits.
- Helmet security headers, CSP, frame denial, content sniffing protection, referrer policy, permissions policy, and production HSTS.
- Production HTTPS redirect and secure cookie mode.
- CORS allowlist in production through `CORS_ORIGINS`.
- Strict request body schemas with Zod.
- Malformed JSON handling and size-limited JSON bodies.
- Backend-only AI calls with timeout, cost-control rate limits, schema validation, and safe fallback.
- User-owned resource authorization checks on protected endpoints.
- Duo privacy controls: routine status, streak, and notes only; photos are never shared by default.
- Zero-trust image upload checks:
  - Data URL schema validation.
  - Magic-byte validation for JPG, PNG, and WEBP.
  - SVG rejected.
  - MIME mismatch rejected.
  - File size and pixel-count limits.
  - Secure random filenames.
  - Storage outside public web root.
  - Common metadata stripping for JPEG, PNG, and WEBP.
  - Suspicious upload logging and temporary blocking.
- Structured logs with token/password/secret redaction.
- Security events are logged without private photos and should be routed to monitored admin alerts in production.
- Frontend error boundary and upload retry affordances.

## Required Production Environment

Production startup fails unless:

- `SESSION_SECRET` is set and at least 32 characters.
- `CORS_ORIGINS` is set.
- If `AI_PROVIDER` is not `mock`, both `AI_API_URL` and `AI_API_KEY` are set.

Use HTTPS at the load balancer or platform edge. Cookies use `Secure` in production and HSTS is enabled.

## Archive Upload Policy

Archive uploads are not implemented. If added later:

- Do not extract archives in the main backend process.
- Inspect archive metadata before extraction.
- Reject decompression bombs, nested archives, suspicious compression ratios, too many files, deep folder nesting, symlinks, hard links, absolute paths, `../` traversal, hidden paths, and oversized extracted data.
- Enforce extracted-size, file-count, folder-depth, CPU, RAM, disk, and timeout limits.
- Process in a sandboxed worker/container with no shell or network access.

## Remaining Production Tasks

- Replace local JSON storage with PostgreSQL or MongoDB.
- Move local image storage to private object storage with short-lived signed download URLs.
- Add managed malware scanning and sandboxed image re-encoding workers for high-risk deployments.
- Add centralized monitoring, alerting, and immutable audit logs.
- Add a documented breach response workflow with user notification templates and regulator notification timelines for each launch region.
- Add a managed bot-protection layer at the edge for public launch.
