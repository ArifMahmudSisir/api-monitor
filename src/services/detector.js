const RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Pure function: evaluates one API response record against the thresholds.
 * Returns { anomalous, severity, severityRank, issues[] }.
 */
function detect(entry, { slowMs, criticalMs }) {
  const issues = [];
  const add = (type, severity, detail) => issues.push({ type, severity, detail });
  const { response_time_ms: rt, status_code: sc, records_returned: rec } = entry;

  const validStatus = Number.isInteger(sc) && sc >= 100 && sc <= 599;
  if (!validStatus) add('INVALID_DATA', 'high', `Invalid status_code: ${JSON.stringify(sc)}`);
  else if (sc >= 500) add('FAILED_REQUEST', 'critical', `HTTP ${sc} server error`);
  else if (sc >= 400) add('CLIENT_ERROR', 'high', `HTTP ${sc} client error`);
  else if (sc < 200 || sc >= 300) add('UNEXPECTED_STATUS', 'low', `Unexpected HTTP ${sc}`);

  if (!isNum(rt) || rt < 0) add('INVALID_DATA', 'medium', `Invalid response_time_ms: ${JSON.stringify(rt)}`);
  else if (rt >= criticalMs) add('HIGH_RESPONSE_TIME', 'high', `${rt} ms (critical limit ${criticalMs} ms)`);
  else if (rt >= slowMs) add('HIGH_RESPONSE_TIME', 'medium', `${rt} ms (slow limit ${slowMs} ms)`);

  if (!Number.isInteger(rec) || rec < 0) add('INVALID_DATA', 'high', `Invalid records_returned: ${JSON.stringify(rec)}`);
  else if (rec === 0) {
    const ok = validStatus && sc >= 200 && sc < 300;
    add('NO_RECORDS', ok ? 'high' : 'medium', 'Zero records returned');
  }

  const rank = issues.reduce((m, i) => Math.max(m, RANK[i.severity]), 0);
  return {
    anomalous: issues.length > 0,
    severity: Object.keys(RANK).find((k) => RANK[k] === rank) || null,
    severityRank: rank,
    issues,
  };
}

/** Validates the envelope. Only api_name is mandatory, since we cannot attribute an alert without it. */
function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'Entry must be an object';
  if (typeof entry.api_name !== 'string' || !entry.api_name.trim()) return 'api_name is required';
  return null;
}

const fingerprint = (apiName, issues) =>
  `${apiName}|${[...new Set(issues.map((i) => i.type))].sort().join(',')}`;

module.exports = { detect, validateEntry, fingerprint, RANK };
