import { apiRequest } from "./client";
import type {
  AttendanceFilters,
  AttendanceRecord,
  CsvImportResult,
  QrSession,
  Team,
} from "../types";

function toQueryString(params: Record<string, string | undefined | boolean>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });
  return searchParams.toString();
}

export async function fetchTeams() {
  return apiRequest<Team[]>("/api/teams");
}

export async function fetchAttendanceRecords(filters: AttendanceFilters) {
  const query = toQueryString({
    date: filters.date,
    teamId: filters.teamId,
    status: filters.status,
    anomaliesOnly: filters.anomaliesOnly,
  });

  return apiRequest<AttendanceRecord[]>(`/api/attendance?${query}`);
}

export async function fetchActiveQrSessions() {
  return apiRequest<QrSession[]>("/api/attendance/qr-sessions?status=active");
}

export async function launchAttendanceQr(teamId?: string) {
  return apiRequest<QrSession>("/api/attendance/qr-sessions", {
    method: "POST",
    body: JSON.stringify({ teamId }),
  });
}

export async function importEmployeesCsv(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/import/employees", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<CsvImportResult>;
}

export async function exportAttendanceCsv(filters: AttendanceFilters) {
  const query = toQueryString({
    date: filters.date,
    teamId: filters.teamId,
    status: filters.status,
    anomaliesOnly: filters.anomaliesOnly,
  });

  const response = await fetch(`/api/export/attendance?${query}`);

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.blob();
}

export async function exportAnomaliesCsv(filters: AttendanceFilters) {
  const query = toQueryString({
    date: filters.date,
    teamId: filters.teamId,
    status: filters.status,
    anomaliesOnly: true,
  });

  const response = await fetch(`/api/export/anomalies?${query}`);

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.blob();
}
