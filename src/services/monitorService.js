const Alert = require('../models/Alert');
const { sendReport } = require('./mailer');
const config = require('../config');
const logger = require('../logger');
const { detect, validateEntry, fingerprint } = require('./detector');
const { generateAlert } = require('./alertGenerator');


async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function processBatch(entries, { sendEmail = false, recipient = null } = {}) {
  const summary = { received: entries.length, healthy: 0, anomalies: 0, deduplicated: 0, rejected: [] };
  const fresh = new Map(); // fingerprint -> candidate (collapses duplicates inside one batch)

  for (const [index, entry] of entries.entries()) {
    const problem = validateEntry(entry);
    if (problem) {
      summary.rejected.push({ index, reason: problem });
      continue;
    }
    const result = detect(entry, config.thresholds);
    if (!result.anomalous) {
      summary.healthy++;
      continue;
    }
    summary.anomalies++;
    const apiName = entry.api_name.trim();
    const fp = fingerprint(apiName, result.issues);
    const metrics = {
      responseTimeMs: entry.response_time_ms,
      statusCode: entry.status_code,
      recordsReturned: entry.records_returned,
    };

    // Already tracking this exact problem: bump the counter instead of creating noise (and LLM cost).
    const existing = await Alert.findOneAndUpdate(
      { fingerprint: fp, status: 'active' },
      { $inc: { occurrences: 1 }, $set: { lastSeenAt: new Date(), metrics } }
    );
    if (existing) {
      summary.deduplicated++;
      continue;
    }
    if (fresh.has(fp)) {
      fresh.get(fp).occurrences++;
      summary.deduplicated++;
      continue;
    }
    fresh.set(fp, { apiName, fingerprint: fp, metrics, occurrences: 1, ...result });
  }

  const candidates = [...fresh.values()];
  const generated = await mapLimit(candidates, config.llm.concurrency, generateAlert);
  const docs = candidates.map((c, i) => ({
    apiName: c.apiName,
    fingerprint: c.fingerprint,
    severity: c.severity,
    severityRank: c.severityRank,
    issues: c.issues,
    metrics: c.metrics,
    occurrences: c.occurrences,
    message: generated[i].message,
    messageSource: generated[i].source,
  }));
  const alerts = docs.length ? await Alert.insertMany(docs) : [];

  let email = { sent: false, reason: 'Not requested' };
  if (sendEmail) {
    // Always send ALL currently active alerts, not just new ones.
    // This ensures the email fires even when every anomaly was deduplicated.
    const allActive = await Alert.find({ status: 'active' }).sort({ severityRank: -1 });
    email = await sendReport(summary, allActive, recipient);
  }
  logger.info(
    `Batch done: received=${summary.received} healthy=${summary.healthy} anomalies=${summary.anomalies} ` +
      `new=${alerts.length} dedup=${summary.deduplicated} rejected=${summary.rejected.length}`
  );
  return { summary, email, alerts };
}

module.exports = { processBatch };
