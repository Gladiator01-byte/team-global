const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceMeters(pointA, pointB) {
  const lat1 = toRadians(pointA.latitude);
  const lon1 = toRadians(pointA.longitude);
  const lat2 = toRadians(pointB.latitude);
  const lon2 = toRadians(pointB.longitude);

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Ray-casting point-in-polygon.
 * Polygon points are [{ latitude, longitude }]
 */
export function pointInPolygon(point, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersects = ((yi > point.latitude) !== (yj > point.latitude))
      && (point.longitude < ((xj - xi) * (point.latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function distanceToPolygonBoundaryMeters(point, polygon) {
  if (polygon.length === 0) {
    return Infinity;
  }

  let minDistance = Infinity;
  for (const vertex of polygon) {
    const distance = haversineDistanceMeters(point, vertex);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

function normalizeGeofence(config) {
  if (!config || !config.type) {
    throw new Error('Geofence config is required.');
  }

  if (config.type === 'radius') {
    if (!config.center || typeof config.radiusMeters !== 'number') {
      throw new Error('Radius geofence requires center and radiusMeters.');
    }

    return config;
  }

  if (config.type === 'polygon') {
    if (!Array.isArray(config.coordinates) || config.coordinates.length < 3) {
      throw new Error('Polygon geofence requires at least 3 coordinates.');
    }

    return config;
  }

  throw new Error(`Unsupported geofence type: ${config.type}`);
}

export function evaluateGeofence({
  employeeLocation,
  geofence,
}) {
  const normalized = normalizeGeofence(geofence);

  if (normalized.type === 'radius') {
    const distanceMeters = haversineDistanceMeters(employeeLocation, normalized.center);
    return {
      inside: distanceMeters <= normalized.radiusMeters,
      distanceMeters,
      boundaryType: 'radius',
      boundaryMeters: normalized.radiusMeters,
    };
  }

  const inside = pointInPolygon(employeeLocation, normalized.coordinates);
  return {
    inside,
    distanceMeters: distanceToPolygonBoundaryMeters(employeeLocation, normalized.coordinates),
    boundaryType: 'polygon',
    boundaryMeters: null,
  };
}

export function evaluateAttendanceAttempt({
  attempt,
  policy,
  geofence,
  nowMs = Date.now(),
}) {
  const reasons = [];

  const ageMs = nowMs - attempt.timestampMs;
  if (ageMs > policy.maxLocationAgeMs) {
    reasons.push('stale_location');
  }

  if (attempt.accuracyMeters > policy.maxAccuracyMeters) {
    reasons.push('low_accuracy');
  }

  const geofenceCheck = evaluateGeofence({
    employeeLocation: {
      latitude: attempt.latitude,
      longitude: attempt.longitude,
    },
    geofence,
  });

  if (!geofenceCheck.inside) {
    reasons.push('outside_geofence');
  }

  return {
    decision: reasons.length === 0 ? 'approved' : 'rejected',
    reasons,
    metadata: {
      distanceMeters: geofenceCheck.distanceMeters,
      accuracyMeters: attempt.accuracyMeters,
      locationAgeMs: ageMs,
      geofenceType: geofenceCheck.boundaryType,
      thresholdAccuracyMeters: policy.maxAccuracyMeters,
      thresholdLocationAgeMs: policy.maxLocationAgeMs,
      geofenceInside: geofenceCheck.inside,
    },
  };
}
