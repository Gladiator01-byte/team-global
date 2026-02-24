from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
import sqlite3
from typing import List, Optional
from zoneinfo import ZoneInfo

UTC = timezone.utc
WAT = ZoneInfo("Africa/Lagos")


class AttendanceError(Exception):
    """Base attendance error."""


class DuplicateOpenSessionError(AttendanceError):
    """Raised when trying to sign in with an already-open session."""


class NoOpenSessionError(AttendanceError):
    """Raised when trying to sign out without an open session."""


@dataclass(frozen=True)
class AttendanceLog:
    id: int
    employee_id: int
    workday_local_date: str
    signed_in_at_utc: datetime
    signed_out_at_utc: Optional[datetime]


class AttendanceService:
    def __init__(self, conn: sqlite3.Connection, night_shift_cutoff_hour: int = 4):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row
        self.night_shift_cutoff_hour = night_shift_cutoff_hour

    @staticmethod
    def migrate(conn: sqlite3.Connection) -> None:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS attendance_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                workday_local_date TEXT NOT NULL,
                signed_in_at_utc TEXT NOT NULL,
                signed_out_at_utc TEXT,
                created_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                CHECK (signed_out_at_utc IS NULL OR signed_out_at_utc >= signed_in_at_utc)
            );

            CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_one_open_per_employee_workday
              ON attendance_sessions(employee_id, workday_local_date)
              WHERE signed_out_at_utc IS NULL;

            CREATE INDEX IF NOT EXISTS idx_attendance_employee_signed_in
              ON attendance_sessions(employee_id, signed_in_at_utc DESC);
            """
        )

    def _now_utc(self) -> datetime:
        return datetime.now(tz=UTC)

    def _utc_iso(self, value: datetime) -> str:
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")

    def _parse_utc(self, value: Optional[str]) -> Optional[datetime]:
        if value is None:
            return None
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)

    def local_workday(self, timestamp_utc: datetime) -> str:
        local = timestamp_utc.astimezone(WAT)
        cutoff = datetime.combine(local.date(), time(self.night_shift_cutoff_hour, 0), tzinfo=WAT)
        if local < cutoff:
            local = local - timedelta(days=1)
        return local.date().isoformat()

    def sign_in(self, employee_id: int, now_utc: Optional[datetime] = None) -> AttendanceLog:
        now_utc = now_utc or self._now_utc()
        workday = self.local_workday(now_utc)
        try:
            with self.conn:
                cur = self.conn.execute(
                    """
                    INSERT INTO attendance_sessions(employee_id, workday_local_date, signed_in_at_utc)
                    VALUES (?, ?, ?)
                    """,
                    (employee_id, workday, self._utc_iso(now_utc)),
                )
                row_id = cur.lastrowid
                row = self.conn.execute(
                    "SELECT * FROM attendance_sessions WHERE id = ?",
                    (row_id,),
                ).fetchone()
        except sqlite3.IntegrityError as exc:
            raise DuplicateOpenSessionError(
                f"Employee {employee_id} already has an open session for workday {workday}."
            ) from exc
        return self._to_log(row)

    def sign_out(self, employee_id: int, now_utc: Optional[datetime] = None) -> AttendanceLog:
        now_utc = now_utc or self._now_utc()
        with self.conn:
            row = self.conn.execute(
                """
                SELECT * FROM attendance_sessions
                WHERE employee_id = ? AND signed_out_at_utc IS NULL
                ORDER BY signed_in_at_utc DESC
                LIMIT 1
                """,
                (employee_id,),
            ).fetchone()
            if row is None:
                raise NoOpenSessionError(f"Employee {employee_id} has no open session.")
            self.conn.execute(
                """
                UPDATE attendance_sessions
                SET signed_out_at_utc = ?, updated_at_utc = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE id = ? AND signed_out_at_utc IS NULL
                """,
                (self._utc_iso(now_utc), row["id"]),
            )
            updated = self.conn.execute(
                "SELECT * FROM attendance_sessions WHERE id = ?",
                (row["id"],),
            ).fetchone()
        if updated["signed_out_at_utc"] is None:
            raise NoOpenSessionError(f"Employee {employee_id} session was already closed.")
        return self._to_log(updated)

    def current_status(self, employee_id: int) -> str:
        row = self.conn.execute(
            """
            SELECT 1 FROM attendance_sessions
            WHERE employee_id = ? AND signed_out_at_utc IS NULL
            LIMIT 1
            """,
            (employee_id,),
        ).fetchone()
        return "checked_in" if row else "checked_out"

    def recent_personal_logs(self, employee_id: int, limit: int = 10) -> List[AttendanceLog]:
        rows = self.conn.execute(
            """
            SELECT * FROM attendance_sessions
            WHERE employee_id = ?
            ORDER BY signed_in_at_utc DESC
            LIMIT ?
            """,
            (employee_id, limit),
        ).fetchall()
        return [self._to_log(r) for r in rows]

    def render_employee_home(self, employee_id: int, logs_limit: int = 5) -> str:
        status = self.current_status(employee_id)
        action_label = "Sign Out" if status == "checked_in" else "Sign In"
        logs = self.recent_personal_logs(employee_id, limit=logs_limit)
        items = "".join(
            f"<li>Workday {l.workday_local_date}: {self._fmt_local(l.signed_in_at_utc)} to {self._fmt_local(l.signed_out_at_utc) if l.signed_out_at_utc else 'OPEN'}</li>"
            for l in logs
        )
        return (
            "<section>"
            f"<h1>Attendance</h1><p>Current status: {status}</p>"
            f"<button>{action_label}</button>"
            f"<h2>Recent Logs</h2><ul>{items}</ul>"
            "</section>"
        )

    def _fmt_local(self, value: Optional[datetime]) -> str:
        if value is None:
            return "-"
        return value.astimezone(WAT).strftime("%Y-%m-%d %H:%M:%S %Z")

    def _to_log(self, row: sqlite3.Row) -> AttendanceLog:
        return AttendanceLog(
            id=row["id"],
            employee_id=row["employee_id"],
            workday_local_date=row["workday_local_date"],
            signed_in_at_utc=self._parse_utc(row["signed_in_at_utc"]),
            signed_out_at_utc=self._parse_utc(row["signed_out_at_utc"]),
        )


def create_service(path: str = ":memory:") -> AttendanceService:
    conn = sqlite3.connect(path)
    AttendanceService.migrate(conn)
    return AttendanceService(conn)
