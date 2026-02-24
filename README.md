# Attendance geolocation enforcement

This repository now includes:

- Browser-side location capture with permission-state handling and client-side accuracy gating (`frontend/locationCapture.js`).
- Backend geofence validation for radius and polygon geofences (`backend/geofence.js`).
- Attendance transaction processing that rejects attempts for:
  - outside geofence
  - stale timestamp
  - low GPS accuracy
- Attendance audit logging that stores geofence evaluation metadata (distance, accuracy, thresholds, decision) for anomaly review (`backend/auditLog.js`, `backend/attendanceService.js`).

Run tests:

```bash
npm test
```
