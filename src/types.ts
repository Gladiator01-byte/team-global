export type AttendanceStatus = "present" | "late" | "absent" | "failed";

export type AttendanceAnomalyType =
  | "impossible_location"
  | "rapid_rescan"
  | "repeated_failures";

export interface Team {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  teamId: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  teamId: string;
  teamName: string;
  status: AttendanceStatus;
  timestampIso: string;
  locationLabel?: string;
  anomalies: AttendanceAnomalyType[];
}

export interface QrSession {
  id: string;
  teamId?: string;
  teamName?: string;
  startedAtIso: string;
  expiresAtIso: string;
  status: "active" | "expired";
  scansCount: number;
}

export interface AttendanceFilters {
  date?: string;
  teamId?: string;
  status?: AttendanceStatus;
  anomaliesOnly?: boolean;
}

export interface CsvImportError {
  rowNumber: number;
  message: string;
  rawRow: Record<string, string>;
}

export interface CsvImportResult {
  importedCount: number;
  errors: CsvImportError[];
}
