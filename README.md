## Nonce Issuer + QR Verification Flow

### Backend
- `POST /api/nonce/issue` issues a signed JWT nonce payload with:
  - nonce id
  - issued/expiry timestamps
  - team/site identifier
  - presenter role/id
  - optional geo hint
- Nonce lifetime rotates randomly from 30 to 60 seconds.
- On issue, payload is broadcast to Supabase Realtime (`nonce-issued` event).
- `POST /api/nonce/verify` verifies signature, expiry, and atomically consumes nonce one-time only.
- Successful verification binds nonce to employee id and scan timestamp.

### Frontend components
- `LeaderDisplayPage` renders full-screen QR (`qrcode.react`), countdown, start/pause/stop controls, and state indicator.
- `EmployeeScanFlow` scans using `react-qr-reader`, parses token, submits verify request, and displays outcome.

### Run
```bash
npm install
npm run dev:server
npm test
```
