import argparse
import sqlite3
from pathlib import Path

from app.security_events import detect_anomalies, export_dashboard_csv, fetch_anomaly_view, init_db


def main() -> None:
    parser = argparse.ArgumentParser(description="Security anomaly dashboard helper")
    parser.add_argument("--db", required=True, help="Path to SQLite database")
    parser.add_argument("--role", choices=["leader", "admin"], default="leader")
    parser.add_argument("--export-csv", help="Path to export consolidated dashboard CSV")
    args = parser.parse_args()

    db_path = Path(args.db)
    conn = sqlite3.connect(db_path)
    init_db(conn)
    detect_anomalies(conn)

    rows = fetch_anomaly_view(conn, role=args.role)
    for row in rows:
        print(dict(row))

    if args.export_csv:
        export_dashboard_csv(conn, path=args.export_csv)
        print(f"CSV exported: {args.export_csv}")


if __name__ == "__main__":
    main()
