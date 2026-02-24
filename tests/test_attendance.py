from datetime import datetime, timezone
import sqlite3
import unittest

from attendance import (
    AttendanceService,
    DuplicateOpenSessionError,
    NoOpenSessionError,
)


class AttendanceServiceTests(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        AttendanceService.migrate(self.conn)
        self.service = AttendanceService(self.conn)

    def test_sign_in_creates_open_record(self):
        log = self.service.sign_in(10, now_utc=datetime(2026, 1, 10, 8, 0, tzinfo=timezone.utc))
        self.assertEqual(log.employee_id, 10)
        self.assertIsNone(log.signed_out_at_utc)
        self.assertEqual(self.service.current_status(10), "checked_in")

    def test_one_open_session_per_employee_workday(self):
        now = datetime(2026, 1, 10, 8, 0, tzinfo=timezone.utc)
        self.service.sign_in(10, now_utc=now)
        with self.assertRaises(DuplicateOpenSessionError):
            self.service.sign_in(10, now_utc=now)

    def test_sign_out_closes_open_record(self):
        self.service.sign_in(10, now_utc=datetime(2026, 1, 10, 8, 0, tzinfo=timezone.utc))
        closed = self.service.sign_out(10, now_utc=datetime(2026, 1, 10, 12, 0, tzinfo=timezone.utc))
        self.assertIsNotNone(closed.signed_out_at_utc)
        self.assertEqual(self.service.current_status(10), "checked_out")

    def test_guard_duplicate_close(self):
        with self.assertRaises(NoOpenSessionError):
            self.service.sign_out(10, now_utc=datetime(2026, 1, 10, 12, 0, tzinfo=timezone.utc))

    def test_wat_workday_cutoff_for_night_shift(self):
        # 02:15 WAT should belong to previous workday with default 04:00 cutoff.
        utc_time = datetime(2026, 1, 10, 1, 15, tzinfo=timezone.utc)
        self.assertEqual(self.service.local_workday(utc_time), "2026-01-09")

    def test_home_page_state_and_logs(self):
        sign_in = datetime(2026, 1, 10, 8, 0, tzinfo=timezone.utc)
        sign_out = datetime(2026, 1, 10, 17, 0, tzinfo=timezone.utc)
        self.service.sign_in(22, now_utc=sign_in)
        self.service.sign_out(22, now_utc=sign_out)
        html = self.service.render_employee_home(22)

        self.assertIn("Current status: checked_out", html)
        self.assertIn("<button>Sign In</button>", html)
        self.assertIn("Recent Logs", html)
        self.assertIn("WAT", html)


if __name__ == "__main__":
    unittest.main()
