import { evaluateAttendanceAttempt } from './geofence.js';
import { recordAttendanceAuditEvent } from './auditLog.js';

export function processAttendanceTransaction({
  employeeId,
  action,
  locationAttempt,
  geofenceConfig,
  geolocationPolicy,
  nowMs,
}) {
  const evaluation = evaluateAttendanceAttempt({
    attempt: locationAttempt,
    policy: geolocationPolicy,
    geofence: geofenceConfig,
    nowMs,
  });

  recordAttendanceAuditEvent({
    employeeId,
    action,
    result: evaluation.decision,
    reasons: evaluation.reasons,
    geofenceEvaluation: evaluation.metadata,
    locationAttempt,
  });

  if (evaluation.decision === 'rejected') {
    return {
      accepted: false,
      code: 'ATTENDANCE_REJECTED_BY_GEOFENCE_POLICY',
      message: 'Attendance transaction rejected by geofence policy checks.',
      reasons: evaluation.reasons,
      geofenceEvaluation: evaluation.metadata,
    };
  }

  return {
    accepted: true,
    code: 'ATTENDANCE_ACCEPTED',
    message: 'Attendance transaction accepted.',
    geofenceEvaluation: evaluation.metadata,
  };
}
