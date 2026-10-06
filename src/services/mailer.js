const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../logger');

let transport;
const enabled = (customTo) => Boolean(config.mail.host && (customTo || config.mail.to));

async function sendReport(summary, alerts, recipient = null) {
  const toEmail = recipient || config.mail.to;
  if (!enabled(toEmail)) return { sent: false, reason: 'SMTP_HOST or recipient not configured' };
  if (!alerts.length) return { sent: false, reason: 'No active alerts in the system to report' };
  try {
    transport ||= nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.port === 465,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    });
    const body = alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.apiName}: ${a.message}`).join('\n\n');
    await transport.sendMail({
      from: config.mail.from,
      to: toEmail,
      subject: `API anomaly report: ${alerts.length} active issue(s) detected`,
      text: `Summary: ${summary.received} APIs checked — ${summary.healthy} healthy, ${summary.anomalies} anomalies.\n\nActive Alerts (${alerts.length}):\n\n${body}`,
    });
    logger.info(`Anomaly report emailed to ${toEmail}`);
    return { sent: true };
  } catch (err) {
    logger.error(`Email failed: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendReport };
