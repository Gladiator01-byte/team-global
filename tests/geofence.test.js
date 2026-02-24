import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAttendanceAttempt } from '../backend/geofence.js';
import { clearAttendanceAuditEvents, listAttendanceAuditEvents } from '../backend/auditLog.js';
import { processAttendanceTransaction } from '../backend/attendanceService.js';

const radiusGeofence = {
  type: 'radius',
  center: { latitude: 37.7749, longitude: -122.4194 },
  radiusMeters: 500,
};

const polygonGeofence = {
  type: 'polygon',
  coordinates: [
    { latitude: 37.7755, longitude: -122.4204 },
    { latitude: 37.7755, longitude: -122.4170 },
    { latitude: 37.7730, longitude: -122.4170 },
    { latitude: 37.7730, longitude: -122.4204 },
  ],
};

const policy = {
  maxLocationAgeMs: 60_000,
  maxAccuracyMeters: 50,
};

test('rejects attempts outside radius geofence', () => {
  const result = evaluateAttendanceAttempt({
    attempt: {
      latitude: 37.7840,
      longitude: -122.4090,
      accuracyMeters: 10,
      timestampMs: Date.now(),
    },
    policy,
    geofence: radiusGeofence,
  });

  assert.equal(result.decision, 'rejected');
  assert.ok(result.reasons.includes('outside_geofence'));
});

test('rejects stale and low-accuracy location', () => {
  const nowMs = Date.now();
  const result = evaluateAttendanceAttempt({
    attempt: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracyMeters: 75,
      timestampMs: nowMs - 120_000,
    },
    policy,
    geofence: radiusGeofence,
    nowMs,
  });

  assert.equal(result.decision, 'rejected');
  assert.deepEqual(result.reasons.sort(), ['low_accuracy', 'stale_location'].sort());
});

test('accepts valid polygon attempt and records audit metadata', () => {
  clearAttendanceAuditEvents();

  const transactionResult = processAttendanceTransaction({
    employeeId: 'emp-100',
    action: 'sign_in',
    locationAttempt: {
      latitude: 37.7740,
      longitude: -122.4188,
      accuracyMeters: 20,
      timestampMs: Date.now(),
    },
    geofenceConfig: polygonGeofence,
    geolocationPolicy: policy,
  });

  assert.equal(transactionResult.accepted, true);

  const [auditEvent] = listAttendanceAuditEvents();
  assert.equal(auditEvent.result, 'approved');
  assert.equal(auditEvent.geofenceEvaluation.geofenceType, 'polygon');
  assert.equal(typeof auditEvent.geofenceEvaluation.distanceMeters, 'number');
  assert.equal(auditEvent.geofenceEvaluation.accuracyMeters, 20);
});
