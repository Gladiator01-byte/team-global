# Security Event Persistence and Anomaly Dashboard

This repository now includes a minimal implementation for:

- Persisting security events:
  - passkey registration/auth outcomes
  - nonce issued/expired/consumed and attempt outcomes
  - failed geofence checks
  - replay attempts and failed scans
- Heuristic anomaly detection rules:
  - repeated failed scans by same user/device
  - same nonce scanned by many users in a short burst
  - attendance from inconsistent locations in short intervals
- Leader/admin anomaly views and CSV export that includes both anomalies and raw events.

## Files

- `app/security_events.py`: SQLite schema, event persistence helpers, heuristic detector, role-specific anomaly views, CSV export.
- `app/dashboard.py`: simple CLI to run anomaly detection, print dashboard view rows, and export CSV.
- `tests/test_security_events.py`: unit tests for persistence, heuristics, and CSV export.

## Usage

```bash
python -m app.dashboard --db ./security.db --role admin --export-csv ./dashboard_export.csv
```

