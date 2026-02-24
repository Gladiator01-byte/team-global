const QUEUE_KEY = 'attendance_submission_queue_v1';
const RECON_KEY = 'attendance_reconciliation_v1';

const form = document.getElementById('attendanceForm');
const offlineBanner = document.getElementById('offlineBanner');
const queuedCount = document.getElementById('queuedCount');
const syncState = document.getElementById('syncState');
const progressBar = document.getElementById('progressBar');
const reconList = document.getElementById('reconciliation');
const toast = document.getElementById('toast');

let syncInFlight = false;

function uuidLike() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (_err) {
    return fallback;
  }
}

function writeJson(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function getQueue() {
  return readJson(QUEUE_KEY, []);
}

function setQueue(entries) {
  writeJson(QUEUE_KEY, entries);
  renderMeta();
}

function pushReconciliation(entry) {
  const state = readJson(RECON_KEY, []);
  state.unshift(entry);
  writeJson(RECON_KEY, state.slice(0, 50));
  renderReconciliation();
}

function renderReconciliation() {
  const items = readJson(RECON_KEY, []);
  reconList.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = `status-${item.status}`;
    li.textContent = `${new Date(item.at).toLocaleTimeString()} | ${item.studentId} | ${item.status} | ${item.message}`;
    reconList.appendChild(li);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2200);
}

function renderOnlineState() {
  const online = navigator.onLine;
  offlineBanner.classList.toggle('visible', !online);
}

function renderMeta() {
  queuedCount.textContent = `${getQueue().length}`;
}

async function sendEvent(event) {
  const response = await fetch('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || 'Submission failed');
  }

  return payload;
}

async function flushQueue() {
  if (!navigator.onLine || syncInFlight) {
    return;
  }

  const queue = getQueue();
  if (!queue.length) {
    syncState.textContent = 'idle';
    progressBar.value = 0;
    return;
  }

  syncInFlight = true;
  syncState.textContent = 'syncing';
  let processed = 0;
  showToast(`Sync started (${queue.length} queued)`);

  while (queue.length && navigator.onLine) {
    const current = queue[0];
    try {
      const payload = await sendEvent(current);
      queue.shift();
      setQueue(queue);
      processed += 1;
      progressBar.value = Math.round((processed / (processed + queue.length)) * 100);
      pushReconciliation({
        at: new Date().toISOString(),
        studentId: current.studentId,
        idempotencyKey: current.idempotencyKey,
        status: payload.status,
        message: payload.message,
      });
    } catch (error) {
      pushReconciliation({
        at: new Date().toISOString(),
        studentId: current.studentId,
        idempotencyKey: current.idempotencyKey,
        status: 'failed',
        message: error.message,
      });
      syncState.textContent = 'blocked';
      showToast(`Sync paused: ${error.message}`);
      syncInFlight = false;
      return;
    }
  }

  syncInFlight = false;
  syncState.textContent = 'idle';
  progressBar.value = 100;
  showToast('Queue synchronized successfully');
  setTimeout(() => {
    if (!syncInFlight) {
      progressBar.value = 0;
    }
  }, 1000);
}

async function queueOrSend(event) {
  if (!navigator.onLine) {
    const queue = getQueue();
    queue.push(event);
    setQueue(queue);
    pushReconciliation({
      at: new Date().toISOString(),
      studentId: event.studentId,
      idempotencyKey: event.idempotencyKey,
      status: 'queued',
      message: 'Stored locally while offline',
    });
    showToast('Offline: attendance queued');
    return;
  }

  try {
    const payload = await sendEvent(event);
    pushReconciliation({
      at: new Date().toISOString(),
      studentId: event.studentId,
      idempotencyKey: event.idempotencyKey,
      status: payload.status,
      message: payload.message,
    });
    showToast(`Submitted (${payload.status})`);
  } catch (_error) {
    const queue = getQueue();
    queue.push(event);
    setQueue(queue);
    pushReconciliation({
      at: new Date().toISOString(),
      studentId: event.studentId,
      idempotencyKey: event.idempotencyKey,
      status: 'queued',
      message: 'Network error. Stored for retry.',
    });
    showToast('Network issue: moved to queue');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    studentId: formData.get('studentId'),
    eventType: formData.get('eventType'),
    scannerId: formData.get('scannerId') || null,
    clientTimestamp: new Date().toISOString(),
    idempotencyKey: uuidLike(),
  };

  await queueOrSend(payload);
  form.reset();
  flushQueue();
});

window.addEventListener('online', () => {
  renderOnlineState();
  showToast('Back online. Syncing queued submissions...');
  flushQueue();
});
window.addEventListener('offline', renderOnlineState);

renderOnlineState();
renderMeta();
renderReconciliation();
flushQueue();
