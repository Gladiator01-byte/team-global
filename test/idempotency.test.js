const test = require('node:test');
const assert = require('node:assert/strict');

const { createServer, attendanceRecords, idempotencyIndex } = require('../server');

let server;

test.before(() => {
  server = createServer().listen(0);
});

test.after(() => {
  server.close();
});

test.beforeEach(() => {
  attendanceRecords.splice(0, attendanceRecords.length);
  idempotencyIndex.clear();
});

test('backend deduplicates by idempotency key', async () => {
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/api/attendance`;

  const event = {
    studentId: 'A100',
    eventType: 'check-in',
    clientTimestamp: new Date().toISOString(),
    idempotencyKey: 'idem-key-1',
  };

  const first = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  assert.equal(first.status, 201);
  const firstPayload = await first.json();
  assert.equal(firstPayload.status, 'created');

  const second = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  assert.equal(second.status, 200);
  const secondPayload = await second.json();
  assert.equal(secondPayload.status, 'duplicate');
  assert.equal(secondPayload.record.id, firstPayload.record.id);
  assert.equal(attendanceRecords.length, 1);
});
