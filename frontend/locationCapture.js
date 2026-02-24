const DEFAULT_CAPTURE_OPTIONS = {
  enableHighAccuracy: true,
  timeoutMs: 12_000,
  maximumAgeMs: 10_000,
  requiredAccuracyMeters: 50,
};

function mapPermissionState(state) {
  if (state === 'granted' || state === 'denied' || state === 'prompt') {
    return state;
  }

  return 'unknown';
}

async function readPermissionState() {
  if (!globalThis.navigator?.permissions?.query) {
    return 'unknown';
  }

  try {
    const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
    return mapPermissionState(permissionStatus.state);
  } catch {
    return 'unknown';
  }
}

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Capture client location and metadata for a sign-in/out attempt.
 *
 * @param {Partial<typeof DEFAULT_CAPTURE_OPTIONS>} overrideOptions
 * @returns {Promise<{
 *   status: 'ok' | 'denied' | 'unavailable' | 'timeout' | 'accuracy_too_low',
 *   permission: string,
 *   capturedAt: string,
 *   location?: {
 *     latitude: number,
 *     longitude: number,
 *     accuracyMeters: number,
 *     timestampMs: number,
 *   },
 *   reason?: string,
 * }>} 
 */
export async function captureLocationAttempt(overrideOptions = {}) {
  const options = { ...DEFAULT_CAPTURE_OPTIONS, ...overrideOptions };

  if (!globalThis.navigator?.geolocation) {
    return {
      status: 'unavailable',
      permission: 'unsupported',
      capturedAt: new Date().toISOString(),
      reason: 'Geolocation API is not available on this device.',
    };
  }

  const permission = await readPermissionState();

  let position;
  try {
    position = await getCurrentPosition({
      enableHighAccuracy: options.enableHighAccuracy,
      timeout: options.timeoutMs,
      maximumAge: options.maximumAgeMs,
    });
  } catch (error) {
    const code = Number(error?.code);
    const statusByCode = {
      1: 'denied',
      2: 'unavailable',
      3: 'timeout',
    };

    return {
      status: statusByCode[code] ?? 'unavailable',
      permission,
      capturedAt: new Date().toISOString(),
      reason: error?.message ?? 'Unable to fetch current position.',
    };
  }

  const accuracyMeters = position.coords.accuracy;
  if (accuracyMeters > options.requiredAccuracyMeters) {
    return {
      status: 'accuracy_too_low',
      permission,
      capturedAt: new Date().toISOString(),
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters,
        timestampMs: position.timestamp,
      },
      reason: `Accuracy ${accuracyMeters.toFixed(1)}m is above threshold ${options.requiredAccuracyMeters}m.`,
    };
  }

  return {
    status: 'ok',
    permission,
    capturedAt: new Date().toISOString(),
    location: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters,
      timestampMs: position.timestamp,
    },
  };
}
