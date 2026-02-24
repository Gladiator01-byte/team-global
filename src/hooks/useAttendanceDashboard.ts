import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  exportAnomaliesCsv,
  exportAttendanceCsv,
  fetchActiveQrSessions,
  fetchAttendanceRecords,
  fetchTeams,
  importEmployeesCsv,
  launchAttendanceQr,
} from "../api/attendance";
import type { AttendanceFilters, AttendanceRecord, QrSession } from "../types";

const defaultFilters: AttendanceFilters = {
  anomaliesOnly: false,
};

export function useAttendanceDashboard() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AttendanceFilters>(defaultFilters);

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: fetchTeams,
  });

  const attendanceQuery = useQuery({
    queryKey: ["attendance", filters],
    queryFn: () => fetchAttendanceRecords(filters),
    refetchInterval: 20_000,
  });

  const activeSessionsQuery = useQuery({
    queryKey: ["active-qr-sessions"],
    queryFn: fetchActiveQrSessions,
    refetchInterval: 10_000,
  });

  const launchQrMutation = useMutation({
    mutationFn: launchAttendanceQr,
    onMutate: async (teamId) => {
      await queryClient.cancelQueries({ queryKey: ["active-qr-sessions"] });
      const previous = queryClient.getQueryData<QrSession[]>(["active-qr-sessions"]);

      if (previous) {
        const optimistic: QrSession = {
          id: `optimistic-${Date.now()}`,
          teamId,
          teamName: teamsQuery.data?.find((team) => team.id === teamId)?.name,
          startedAtIso: new Date().toISOString(),
          expiresAtIso: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          status: "active",
          scansCount: 0,
        };

        queryClient.setQueryData<QrSession[]>(["active-qr-sessions"], [
          optimistic,
          ...previous,
        ]);
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["active-qr-sessions"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["active-qr-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const importMutation = useMutation({
    mutationFn: importEmployeesCsv,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const exportAttendanceMutation = useMutation({
    mutationFn: exportAttendanceCsv,
  });

  const exportAnomaliesMutation = useMutation({
    mutationFn: exportAnomaliesCsv,
  });

  const anomalyCounts = useMemo(() => {
    const empty = {
      impossible_location: 0,
      rapid_rescan: 0,
      repeated_failures: 0,
    };

    return (attendanceQuery.data ?? []).reduce(
      (acc, record: AttendanceRecord) => {
        record.anomalies.forEach((anomaly) => {
          acc[anomaly] += 1;
        });
        return acc;
      },
      { ...empty },
    );
  }, [attendanceQuery.data]);

  return {
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
  };
}
