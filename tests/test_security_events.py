import csv
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

from app.security_events import (
    Event,
    EventType,
    detect_anomalies,
    export_dashboard_csv,
    fetch_anomaly_view,
    init_db,
    log_failed_scan,
    log_geofence_failure,
    log_nonce_event,
    log_passkey_outcome,
    log_replay_attempt,
    persist_event,
)


class SecurityEventsTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        init_db(self.conn)

    def test_persists_required_security_events(self):
        log_passkey_outcome(self.conn, action="registration", success=True, user_id="u1", device_id="d1")
        log_passkey_outcome(self.conn, action="auth", success=False, user_id="u1", device_id="d1")
        log_nonce_event(self.conn, action="issued", nonce="n1", user_id="u1", device_id="d1", success=True)
        log_nonce_event(self.conn, action="attempt", nonce="n1", user_id="u1", device_id="d1", success=False)
        log_geofence_failure(self.conn, user_id="u1", device_id="d1", lat=40.0, lon=-73.0)
        log_replay_attempt(self.conn, user_id="u1", device_id="d1", nonce="n1")

        count = self.conn.execute("SELECT COUNT(*) FROM security_events").fetchone()[0]
        self.assertEqual(count, 6)

    def test_detects_heuristic_anomalies(self):
        now = datetime.now(timezone.utc)

        for _ in range(5):
            persist_event(
                self.conn,
                Event(
                    event_type=EventType.FAILED_SCAN,
                    outcome="failed",
                    user_id="u-repeat",
                    device_id="d-repeat",
                    nonce="n-repeat",
                    lat=40.0,
                    lon=-73.0,
                    occurred_at=now - timedelta(minutes=1),
                ),
            )

        for user in ("u1", "u2", "u3"):
            persist_event(
                self.conn,
                Event(
                    event_type=EventType.NONCE_ATTEMPT,
                    outcome="failed",
                    user_id=user,
                    device_id=f"d-{user}",
                    nonce="burst-nonce",
                    occurred_at=now - timedelta(seconds=30),
                ),
            )
        persist_event(
            self.conn,
            Event(
                event_type=EventType.REPLAY_ATTEMPT,
                outcome="failed",
                user_id="u4",
                device_id="d4",
                nonce="burst-nonce",
                occurred_at=now - timedelta(seconds=25),
            ),
        )

        persist_event(
            self.conn,
            Event(
                event_type=EventType.NONCE_CONSUMED,
                outcome="success",
                user_id="traveler",
                device_id="dev-a",
                lat=40.7128,
                lon=-74.0060,
                occurred_at=now - timedelta(minutes=10),
            ),
        )
        persist_event(
            self.conn,
            Event(
                event_type=EventType.NONCE_CONSUMED,
                outcome="success",
                user_id="traveler",
                device_id="dev-b",
                lat=34.0522,
                lon=-118.2437,
                occurred_at=now - timedelta(minutes=5),
            ),
        )

        anomalies = detect_anomalies(self.conn, now=now)
        self.assertGreaterEqual(anomalies, 3)

        leader_rows = fetch_anomaly_view(self.conn, role="leader")
        admin_rows = fetch_anomaly_view(self.conn, role="admin")
        self.assertGreaterEqual(len(leader_rows), 3)
        self.assertGreaterEqual(len(admin_rows), 3)
        self.assertIn("anomaly_type", leader_rows[0].keys())

    def test_csv_export_includes_anomalies_and_events(self):
        log_failed_scan(self.conn, user_id="u1", device_id="d1", nonce="n1", lat=1.0, lon=1.0)
        detect_anomalies(self.conn)

        with tempfile.NamedTemporaryFile("w+", suffix=".csv") as tmp:
            export_dashboard_csv(self.conn, path=tmp.name)
            tmp.seek(0)
            rows = list(csv.reader(tmp))

        self.assertGreaterEqual(len(rows), 2)
        sections = [row[0] for row in rows[1:]]
        self.assertIn("event", sections)


if __name__ == "__main__":
    unittest.main()
