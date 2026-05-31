# AKRIVO Skin Mobile

Expo Go ready mobile app for AKRIVO Skin.

## Setup

From the backend project root, start the API:

```bash
npm start
```

For testing on a phone, the backend must listen on your network:

```text
HOST=0.0.0.0
```

Find your computer LAN IP address, then create `mobile/.env`:

```text
EXPO_PUBLIC_API_BASE_URL=http://YOUR-COMPUTER-LAN-IP:3000
```

Do not use `127.0.0.1` from a physical phone. In Expo Go, `127.0.0.1` points to the phone, not your computer.

Install and run:

```bash
cd mobile
npm install
npx expo start
```

If npm shows `Invalid Version` or Expo Doctor exits with code 7, the previous install is corrupted. Run:

```powershell
cd "C:\Users\Deepanshu-PC\Documents\skin care\mobile"
powershell -ExecutionPolicy Bypass -File .\repair-install.ps1
```

Scan the QR code with Expo Go.

## Notes

- Uses email/password auth only.
- Uses the existing backend API, CSRF flow, upload validation, AI analysis, routines, progress tracking, Duo, and privacy/legal controls.
- Includes a Razorpay test payment action. For production mobile payments, add Razorpay's native SDK or a hosted checkout flow outside Expo Go.
- No API keys are stored in the mobile app.
- Photo access is only requested when the user chooses an image.
