import type { AttendanceRecord } from "../types";

interface AttendanceTableProps {
  records: AttendanceRecord[];
  isLoading?: boolean;
}

function anomalyLabel(code: string) {
  if (code === "impossible_location") return "Impossible location";
  if (code === "rapid_rescan") return "Rapid re-scan";
  if (code === "repeated_failures") return "Repeated failures";
  return code;
}

export function AttendanceTable({ records, isLoading }: AttendanceTableProps) {
  return (
    <div className="card">
      <h3>Employee Attendance</h3>
      {isLoading && <p>Loading attendance...</p>}
      {!isLoading && records.length === 0 && <p>No attendance records found.</p>}
      {records.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Team</th>
              <th>Status</th>
              <th>Time</th>
              <th>Location</th>
              <th>Anomalies</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>
                  {record.employeeName} ({record.employeeCode})
                </td>
                <td>{record.teamName}</td>
                <td>{record.status}</td>
                <td>{new Date(record.timestampIso).toLocaleString()}</td>
                <td>{record.locationLabel ?? "-"}</td>
                <td>
                  {record.anomalies.length === 0
                    ? "-"
                    : record.anomalies.map((anomaly) => anomalyLabel(anomaly)).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
