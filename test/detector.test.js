const test = require('node:test');
const assert = require('node:assert');
const { detect, validateEntry, fingerprint } = require('../src/services/detector');
const { fallbackMessage } = require('../src/services/alertGenerator');

const T = { slowMs: 3000, criticalMs: 5000 };
const mk = (o) => ({ api_name: 'X', response_time_ms: 100, status_code: 200, records_returned: 10, ...o });

test('healthy response has no issues', () => {
  assert.strictEqual(detect(mk({}), T).anomalous, false);
});

test('500 with zero records is critical (spec example)', () => {
  const r = detect(mk({ api_name: 'AppointmentAPI', response_time_ms: 5500, status_code: 500, records_returned: 0 }), T);
  assert.strictEqual(r.severity, 'critical');
  assert.deepStrictEqual(r.issues.map((i) => i.type).sort(), ['FAILED_REQUEST', 'HIGH_RESPONSE_TIME', 'NO_RECORDS']);
});

test('slow thresholds', () => {
  assert.strictEqual(detect(mk({ response_time_ms: 3000 }), T).severity, 'medium');
  assert.strictEqual(detect(mk({ response_time_ms: 5000 }), T).severity, 'high');
  assert.strictEqual(detect(mk({ response_time_ms: 2999 }), T).anomalous, false);
});

test('zero records on 200 is high', () => {
  assert.strictEqual(detect(mk({ records_returned: 0 }), T).severity, 'high');
});

test('4xx is high, 3xx is low', () => {
  assert.strictEqual(detect(mk({ status_code: 401 }), T).severity, 'high');
  assert.strictEqual(detect(mk({ status_code: 302 }), T).severity, 'low');
});

test('invalid and missing values are flagged, not thrown', () => {
  const r = detect({ api_name: 'X', records_returned: -4 }, T);
  assert.ok(r.issues.every((i) => i.type === 'INVALID_DATA'));
  assert.strictEqual(r.issues.length, 3);
});

test('validateEntry requires api_name', () => {
  assert.ok(validateEntry({}));
  assert.ok(validateEntry(null));
  assert.strictEqual(validateEntry({ api_name: 'A' }), null);
});

test('fingerprint is order-independent and de-duplicates types', () => {
  const a = fingerprint('A', [{ type: 'B' }, { type: 'A' }, { type: 'A' }]);
  assert.strictEqual(a, 'A|A,B');
});

test('fallback message matches the spec example', () => {
  const a = { apiName: 'AppointmentAPI', metrics: { statusCode: 500, responseTimeMs: 100, recordsReturned: 0 },
    issues: [{ type: 'FAILED_REQUEST' }, { type: 'NO_RECORDS' }] };
  assert.strictEqual(fallbackMessage(a), 'AppointmentAPI failed with status 500 and returned 0 records. Possible outage or data issue.');
});
