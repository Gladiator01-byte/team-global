import type { AttendanceFilters, CsvImportResult } from "../types";

interface CsvImportExportPanelProps {
  filters: AttendanceFilters;
  importing: boolean;
  importResult?: CsvImportResult;
  onImport: (file: File) => void;
  onExportAttendance: () => void;
  onExportAnomalies: () => void;
  exportingAttendance: boolean;
  exportingAnomalies: boolean;
}

export function CsvImportExportPanel({
  importing,
  importResult,
  onImport,
  onExportAttendance,
  onExportAnomalies,
  exportingAttendance,
  exportingAnomalies,
}: CsvImportExportPanelProps) {
  return (
    <div className="card">
      <h3>CSV Import / Export</h3>
      <p>Import employees and team assignments, or export attendance/anomaly reports.</p>
      <label>
        Import employees CSV
        <input
          type="file"
          accept=".csv"
          disabled={importing}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImport(file);
          }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={onExportAttendance} disabled={exportingAttendance}>
          {exportingAttendance ? "Exporting..." : "Export attendance CSV"}
        </button>
        <button onClick={onExportAnomalies} disabled={exportingAnomalies}>
          {exportingAnomalies ? "Exporting..." : "Export anomalies CSV"}
        </button>
      </div>

      {importResult && (
        <div style={{ marginTop: 12 }}>
          <p>Imported rows: {importResult.importedCount}</p>
          {importResult.errors.length > 0 && (
            <>
              <h4>Validation error report</h4>
              <ul>
                {importResult.errors.map((error) => (
                  <li key={`${error.rowNumber}-${error.message}`}>
                    Row {error.rowNumber}: {error.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
