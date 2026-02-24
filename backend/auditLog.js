const attendanceAuditEvents = [];

export function recordAttendanceAuditEvent(event) {
  attendanceAuditEvents.push({
    ...event,
    recordedAt: new Date().toISOString(),
  });
}

export function listAttendanceAuditEvents() {
  return [...attendanceAuditEvents];
}

export function clearAttendanceAuditEvents() {
  attendanceAuditEvents.length = 0;
}
