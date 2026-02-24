const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;

const attendanceRecords = [];
const idempotencyIndex = new Map();

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'Payload must be a JSON object.';
  }

  const requiredFields = ['studentId', 'eventType', 'idempotencyKey', 'clientTimestamp'];
  const missing = requiredFields.filter((field) => !payload[field]);
  if (missing.length) {
    return `Missing required fields: ${missing.join(', ')}`;
  }

  return null;
}

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function handleAttendancePost(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(body || '{}');
    } catch (_err) {
      sendJson(res, 400, { ok: false, status: 'invalid', message: 'Invalid JSON payload.' });
      return;
    }

    const error = validatePayload(payload);
    if (error) {
      sendJson(res, 400, { ok: false, status: 'invalid', message: error });
      return;
    }

    const { idempotencyKey } = payload;
    if (idempotencyIndex.has(idempotencyKey)) {
      const existing = idempotencyIndex.get(idempotencyKey);
      sendJson(res, 200, {
        ok: true,
        status: 'duplicate',
        message: 'Submission already processed. Returning existing attendance record.',
        record: existing,
      });
      return;
    }

    const record = {
      id: attendanceRecords.length + 1,
      studentId: payload.studentId,
      eventType: payload.eventType,
      scannerId: payload.scannerId || null,
      clientTimestamp: payload.clientTimestamp,
      idempotencyKey,
      receivedAt: new Date().toISOString(),
    };

    attendanceRecords.push(record);
    idempotencyIndex.set(idempotencyKey, record);

    sendJson(res, 201, {
      ok: true,
      status: 'created',
      message: 'Attendance captured successfully.',
      record,
    });
  });
}

function serveStatic(req, res) {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(__dirname, 'public', path.normalize(reqPath));

  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const type = ext === '.js' ? 'application/javascript' : 'text/html';
    res.writeHead(200, { 'Content-Type': type });
    res.end(content);
  });
}

function requestHandler(req, res) {
  if (req.method === 'POST' && req.url === '/api/attendance') {
    handleAttendancePost(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/api/attendance') {
    sendJson(res, 200, { ok: true, total: attendanceRecords.length, records: attendanceRecords });
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
}

function createServer() {
  return http.createServer(requestHandler);
}

if (require.main === module) {
  createServer().listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
  });
}

module.exports = { createServer, attendanceRecords, idempotencyIndex };
