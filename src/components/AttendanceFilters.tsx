import type { AttendanceFilters as Filters, AttendanceStatus, Team } from "../types";

interface AttendanceFiltersProps {
  teams: Team[];
  value: Filters;
  onChange: (value: Filters) => void;
}

const statuses: AttendanceStatus[] = ["present", "late", "absent", "failed"];

export function AttendanceFilters({ teams, value, onChange }: AttendanceFiltersProps) {
  return (
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <h3>Attendance Filters</h3>
      <label>
        Date
        <input
          type="date"
          value={value.date ?? ""}
          onChange={(event) => onChange({ ...value, date: event.target.value || undefined })}
        />
      </label>
      <label>
        Team
        <select
          value={value.teamId ?? ""}
          onChange={(event) => onChange({ ...value, teamId: event.target.value || undefined })}
        >
          <option value="">All teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select
          value={value.status ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              status: (event.target.value as AttendanceStatus) || undefined,
            })
          }
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={Boolean(value.anomaliesOnly)}
          onChange={(event) => onChange({ ...value, anomaliesOnly: event.target.checked })}
        />
        Show anomalies only
      </label>
    </div>
  );
}
