require('dotenv').config();
const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(+v) ? +v : d);

module.exports = {
  port: num(process.env.PORT, 3000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/api_monitor',
  logLevel: process.env.LOG_LEVEL || 'info',
  maxBatchSize: num(process.env.MAX_BATCH_SIZE, 500),
  thresholds: {
    slowMs: num(process.env.SLOW_MS, 3000),
    criticalMs: num(process.env.CRITICAL_MS, 5000),
  },
  llm: {
    provider: (process.env.LLM_PROVIDER || 'openai').toLowerCase(),
    openaiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    geminiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    timeoutMs: num(process.env.LLM_TIMEOUT_MS, 15000),
    concurrency: num(process.env.LLM_CONCURRENCY, 5),
  },
  mail: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'alerts@example.com',
    to: process.env.ALERT_EMAIL_RECIPIENT || process.env.ALERT_EMAIL_TO || '',
  },
};
