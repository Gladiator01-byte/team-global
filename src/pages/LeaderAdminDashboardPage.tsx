import { useState } from "react";
import { ActiveQrSessionsMonitor } from "../components/ActiveQrSessionsMonitor";
import { AttendanceFilters } from "../components/AttendanceFilters";
import { AttendanceTable } from "../components/AttendanceTable";
import { CsvImportExportPanel } from "../components/CsvImportExportPanel";
import { DisplayAttendanceQrButton } from "../components/DisplayAttendanceQrButton";
import { useAttendanceDashboard } from "../hooks/useAttendanceDashboard";
import { downloadBlob } from "../utils/file";

export function LeaderAdminDashboardPage() {
  const {
    filters,
    setFilters,
    teamsQuery,
    attendanceQuery,
    activeSessionsQuery,
    launchQrMutation,
    importMutation,
    exportAttendanceMutation,
    exportAnomaliesMutation,
    anomalyCounts,
  } = useAttendanceDashboard();

  const [importResult, setImportResult] = useState(importMutation.data);

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h2>Leadership & Admin Attendance Dashboard</h2>

      <DisplayAttendanceQrButton
        teams={teamsQuery.data ?? []}
        isLaunching={launchQrMutation.isPending}
        onLaunch={(teamId) => launchQrMutation.mutate(teamId)}
      />

      <ActiveQrSessionsMonitor
        sessions={activeSessionsQuery.data ?? []}
        isLoading={activeSessionsQuery.isLoading}
      />

      <section className="card">
        <h3>Anomaly Indicators</h3>
        <ul>
          <li>Impossible location: {anomalyCounts.impossible_location}</li>
          <li>Rapid re-scan: {anomalyCounts.rapid_rescan}</li>
          <li>Repeated failures: {anomalyCounts.repeated_failures}</li>
        </ul>
      </section>

      <AttendanceFilters
        teams={teamsQuery.data ?? []}
        value={filters}
        onChange={setFilters}
      />

      <AttendanceTable
        records={attendanceQuery.data ?? []}
        isLoading={attendanceQuery.isLoading}
      />

      <CsvImportExportPanel
        filters={filters}
        importing={importMutation.isPending}
        importResult={importResult}
        onImport={(file) =>
          importMutation.mutate(file, {
            onSuccess: (result) => setImportResult(result),
          })
        }
        onExportAttendance={() =>
          exportAttendanceMutation.mutate(filters, {
            onSuccess: (blob) => downloadBlob(blob, "attendance-export.csv"),
          })
        }
        onExportAnomalies={() =>
          exportAnomaliesMutation.mutate(filters, {
            onSuccess: (blob) => downloadBlob(blob, "attendance-anomalies-export.csv"),
          })
        }
        exportingAttendance={exportAttendanceMutation.isPending}
        exportingAnomalies={exportAnomaliesMutation.isPending}
      />
    </main>
  );
}
