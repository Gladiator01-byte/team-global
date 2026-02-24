import csv
import math
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Iterable, List, Optional


class EventType(str, Enum):
    PASSKEY_REGISTRATION = "passkey_registration"
    PASSKEY_AUTH = "passkey_auth"
    NONCE_ISSUED = "nonce_issued"
    NONCE_EXPIRED = "nonce_expired"
    NONCE_CONSUMED = "nonce_consumed"
    NONCE_ATTEMPT = "nonce_attempt"
    GEOFENCE_FAILED = "geofence_failed"
    REPLAY_ATTEMPT = "replay_attempt"
    FAILED_SCAN = "failed_scan"


class AnomalyType(str, Enum):
    REPEATED_FAILED_SCANS = "repeated_failed_scans"
    NONCE_MULTI_USER_BURST = "nonce_multi_user_burst"
    INCONSISTENT_LOCATION = "inconsistent_location"


@dataclass
class Event:
    event_type: EventType
    outcome: str
    user_id: Optional[str] = None
    device_id: Optional[str] = None
    nonce: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    meta: Optional[str] = None
    occurred_at: Optional[datetime] = None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS security_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            outcome TEXT NOT NULL,
            user_id TEXT,
            device_id TEXT,
            nonce TEXT,
            lat REAL,
            lon REAL,
            meta TEXT,
            occurred_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_security_events_user_time
            ON security_events(user_id, device_id, occurred_at);
        CREATE INDEX IF NOT EXISTS idx_security_events_nonce_time
            ON security_events(nonce, occurred_at);

        CREATE TABLE IF NOT EXISTS anomalies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            anomaly_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            description TEXT NOT NULL,
            user_id TEXT,
            device_id TEXT,
            nonce TEXT,
            detected_at TEXT NOT NULL,
            event_window_start TEXT,
            event_window_end TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_anomalies_detected_at
            ON anomalies(detected_at);
        """
    )
    conn.commit()


def persist_event(conn: sqlite3.Connection, event: Event) -> int:
    ts = (event.occurred_at or _utcnow()).isoformat()
    cur = conn.execute(
        """
        INSERT INTO security_events(
            event_type, outcome, user_id, device_id, nonce, lat, lon, meta, occurred_at
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event.event_type.value,
            event.outcome,
            event.user_id,
            event.device_id,
            event.nonce,
            event.lat,
            event.lon,
            event.meta,
            ts,
        ),
    )
    conn.commit()
    return int(cur.lastrowid)


def log_passkey_outcome(conn: sqlite3.Connection, *, action: str, success: bool, user_id: str, device_id: str, meta: str = "") -> int:
    event_type = EventType.PASSKEY_REGISTRATION if action == "registration" else EventType.PASSKEY_AUTH
    return persist_event(
        conn,
        Event(
            event_type=event_type,
            outcome="success" if success else "failed",
            user_id=user_id,
            device_id=device_id,
            meta=meta,
        ),
    )


def log_nonce_event(conn: sqlite3.Connection, *, action: str, nonce: str, user_id: Optional[str], device_id: Optional[str], success: bool, meta: str = "") -> int:
    event_map = {
        "issued": EventType.NONCE_ISSUED,
        "expired": EventType.NONCE_EXPIRED,
        "consumed": EventType.NONCE_CONSUMED,
        "attempt": EventType.NONCE_ATTEMPT,
    }
    if action not in event_map:
        raise ValueError(f"unsupported nonce action: {action}")

    return persist_event(
        conn,
        Event(
            event_type=event_map[action],
            outcome="success" if success else "failed",
            nonce=nonce,
            user_id=user_id,
            device_id=device_id,
            meta=meta,
        ),
    )


def log_geofence_failure(conn: sqlite3.Connection, *, user_id: str, device_id: str, lat: float, lon: float, meta: str = "") -> int:
    return persist_event(
        conn,
        Event(
            event_type=EventType.GEOFENCE_FAILED,
            outcome="failed",
            user_id=user_id,
            device_id=device_id,
            lat=lat,
            lon=lon,
            meta=meta,
        ),
    )


def log_replay_attempt(conn: sqlite3.Connection, *, user_id: Optional[str], device_id: Optional[str], nonce: Optional[str], meta: str = "") -> int:
    return persist_event(
        conn,
        Event(
            event_type=EventType.REPLAY_ATTEMPT,
            outcome="failed",
            user_id=user_id,
            device_id=device_id,
            nonce=nonce,
            meta=meta,
        ),
    )


def log_failed_scan(conn: sqlite3.Connection, *, user_id: str, device_id: str, nonce: Optional[str], lat: Optional[float], lon: Optional[float], meta: str = "") -> int:
    return persist_event(
        conn,
        Event(
            event_type=EventType.FAILED_SCAN,
            outcome="failed",
            user_id=user_id,
            device_id=device_id,
            nonce=nonce,
            lat=lat,
            lon=lon,
            meta=meta,
        ),
    )


def _insert_anomaly(conn: sqlite3.Connection, *, anomaly_type: AnomalyType, severity: str, description: str, user_id: Optional[str] = None, device_id: Optional[str] = None, nonce: Optional[str] = None, start: Optional[datetime] = None, end: Optional[datetime] = None) -> None:
    conn.execute(
        """
        INSERT INTO anomalies(
            anomaly_type, severity, description, user_id, device_id, nonce,
            detected_at, event_window_start, event_window_end
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            anomaly_type.value,
            severity,
            description,
            user_id,
            device_id,
            nonce,
            _utcnow().isoformat(),
            start.isoformat() if start else None,
            end.isoformat() if end else None,
        ),
    )


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


def detect_anomalies(conn: sqlite3.Connection, *, now: Optional[datetime] = None) -> int:
    now = now or _utcnow()
    inserted = 0

    # Rule 1: repeated failed scans by same user/device
    failed_window_start = now - timedelta(minutes=10)
    for user_id, device_id, count in conn.execute(
        """
        SELECT user_id, device_id, COUNT(*) as c
        FROM security_events
        WHERE event_type = ?
          AND occurred_at >= ?
        GROUP BY user_id, device_id
        HAVING c >= 5
        """,
        (EventType.FAILED_SCAN.value, failed_window_start.isoformat()),
    ):
        _insert_anomaly(
            conn,
            anomaly_type=AnomalyType.REPEATED_FAILED_SCANS,
            severity="medium",
            description=f"{count} failed scans in 10 minutes",
            user_id=user_id,
            device_id=device_id,
            start=failed_window_start,
            end=now,
        )
        inserted += 1

    # Rule 2: same nonce scanned by many users quickly
    nonce_window_start = now - timedelta(minutes=2)
    for nonce, distinct_users, count in conn.execute(
        """
        SELECT nonce, COUNT(DISTINCT user_id) AS users, COUNT(*) as c
        FROM security_events
        WHERE nonce IS NOT NULL
          AND event_type IN (?, ?, ?)
          AND occurred_at >= ?
        GROUP BY nonce
        HAVING users >= 3 AND c >= 4
        """,
        (
            EventType.NONCE_ATTEMPT.value,
            EventType.FAILED_SCAN.value,
            EventType.REPLAY_ATTEMPT.value,
            nonce_window_start.isoformat(),
        ),
    ):
        _insert_anomaly(
            conn,
            anomaly_type=AnomalyType.NONCE_MULTI_USER_BURST,
            severity="high",
            description=f"nonce seen by {distinct_users} users in short burst ({count} events)",
            nonce=nonce,
            start=nonce_window_start,
            end=now,
        )
        inserted += 1

    # Rule 3: inconsistent locations in short interval
    loc_window_start = now - timedelta(minutes=15)
    users = conn.execute(
        """
        SELECT DISTINCT user_id
        FROM security_events
        WHERE user_id IS NOT NULL
          AND lat IS NOT NULL
          AND lon IS NOT NULL
          AND occurred_at >= ?
        """,
        (loc_window_start.isoformat(),),
    ).fetchall()

    for (user_id,) in users:
        points = conn.execute(
            """
            SELECT device_id, lat, lon, occurred_at
            FROM security_events
            WHERE user_id = ?
              AND lat IS NOT NULL
              AND lon IS NOT NULL
              AND occurred_at >= ?
            ORDER BY occurred_at ASC
            """,
            (user_id, loc_window_start.isoformat()),
        ).fetchall()
        for i in range(1, len(points)):
            prev = points[i - 1]
            curr = points[i]
            dist_km = _haversine_km(prev[1], prev[2], curr[1], curr[2])
            if dist_km > 30:
                start = datetime.fromisoformat(prev[3])
                end = datetime.fromisoformat(curr[3])
                _insert_anomaly(
                    conn,
                    anomaly_type=AnomalyType.INCONSISTENT_LOCATION,
                    severity="high",
                    description=f"location jump {dist_km:.1f}km within minutes",
                    user_id=user_id,
                    device_id=curr[0],
                    start=start,
                    end=end,
                )
                inserted += 1
                break

    conn.commit()
    return inserted


def fetch_anomaly_view(conn: sqlite3.Connection, *, role: str, limit: int = 200) -> List[sqlite3.Row]:
    conn.row_factory = sqlite3.Row
    if role not in {"leader", "admin"}:
        raise ValueError("role must be leader or admin")

    if role == "leader":
        query = """
            SELECT anomaly_type, severity, description, user_id, nonce, detected_at
            FROM anomalies
            ORDER BY detected_at DESC
            LIMIT ?
        """
    else:
        query = """
            SELECT anomaly_type, severity, description, user_id, device_id, nonce,
                   detected_at, event_window_start, event_window_end
            FROM anomalies
            ORDER BY detected_at DESC
            LIMIT ?
        """
    return conn.execute(query, (limit,)).fetchall()


def export_dashboard_csv(conn: sqlite3.Connection, *, path: str) -> None:
    conn.row_factory = sqlite3.Row
    anomalies = conn.execute(
        "SELECT * FROM anomalies ORDER BY detected_at DESC"
    ).fetchall()
    events = conn.execute(
        "SELECT * FROM security_events ORDER BY occurred_at DESC"
    ).fetchall()

    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["section", "id", "type", "outcome_or_severity", "user_id", "device_id", "nonce", "description_or_meta", "timestamp", "window_start", "window_end"])

        for row in anomalies:
            writer.writerow(
                [
                    "anomaly",
                    row["id"],
                    row["anomaly_type"],
                    row["severity"],
                    row["user_id"],
                    row["device_id"],
                    row["nonce"],
                    row["description"],
                    row["detected_at"],
                    row["event_window_start"],
                    row["event_window_end"],
                ]
            )

        for row in events:
            writer.writerow(
                [
                    "event",
                    row["id"],
                    row["event_type"],
                    row["outcome"],
                    row["user_id"],
                    row["device_id"],
                    row["nonce"],
                    row["meta"],
                    row["occurred_at"],
                    "",
                    "",
                ]
            )
