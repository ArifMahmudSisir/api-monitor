const config = require('../config');
const logger = require('../logger');

const SYSTEM_PROMPT = [
  'You are an on-call SRE assistant for a healthcare company that integrates with external patient and operational APIs.',
  'Write ONE alert of 1 to 2 sentences, plain text, no markdown, no emojis, max 280 characters.',
  'Mention the API name and the concrete evidence (status code, record count, response time) from the input.',
  'End with the most likely cause or next check, phrased with hedging ("possible", "likely"). Never invent facts not in the input.',
].join(' ');

const buildUserPrompt = (a) =>
  `Severity: ${a.severity}\nAPI: ${a.apiName}\nStatus code: ${a.metrics.statusCode}\n` +
  `Response time (ms): ${a.metrics.responseTimeMs}\nRecords returned: ${a.metrics.recordsReturned}\n` +
  `Detected issues:\n${a.issues.map((i) => `- ${i.type}: ${i.detail}`).join('\n')}`;

async function post(url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.llm.timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(user) {
  const data = await post(
    'https://api.openai.com/v1/chat/completions',
    { Authorization: `Bearer ${config.llm.openaiKey}` },
    {
      model: config.llm.openaiModel,
      temperature: 0.2,
      max_tokens: 120,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: user },
      ],
    }
  );
  return data.choices?.[0]?.message?.content;
}

async function callGemini(user) {
  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.llm.geminiModel}:generateContent`,
    { 'x-goog-api-key': config.llm.geminiKey },
    {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 150 },
    }
  );
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('');
}

const PHRASES = {
  FAILED_REQUEST: (a) => `failed with status ${a.metrics.statusCode}`,
  CLIENT_ERROR: (a) => `rejected the request with status ${a.metrics.statusCode}`,
  UNEXPECTED_STATUS: (a) => `returned unexpected status ${a.metrics.statusCode}`,
  HIGH_RESPONSE_TIME: (a) => `responded slowly (${a.metrics.responseTimeMs} ms)`,
  NO_RECORDS: () => 'returned 0 records',
  INVALID_DATA: () => 'returned malformed values',
};

function fallbackMessage(a) {
  const types = [...new Set(a.issues.map((i) => i.type))];
  const parts = types.map((t) => PHRASES[t](a));
  const hint = types.includes('FAILED_REQUEST')
    ? 'Possible outage or data issue.'
    : types.includes('INVALID_DATA')
    ? 'Possible schema change or upstream data corruption.'
    : types.includes('CLIENT_ERROR')
    ? 'Check credentials, quotas and request parameters.'
    : 'Investigate upstream health and recent changes.';
  return `${a.apiName} ${parts.join(' and ')}. ${hint}`;
}

const clean = (t) => String(t || '').replace(/\s+/g, ' ').replace(/[*_`#]/g, '').trim().slice(0, 400);

/** Returns { message, source } and never throws: any LLM problem degrades to a template alert. */
async function generateAlert(alert) {
  const { provider, openaiKey, geminiKey } = config.llm;
  const key = provider === 'gemini' ? geminiKey : openaiKey;
  if (!key) return { message: fallbackMessage(alert), source: 'fallback' };
  try {
    const text = clean(await (provider === 'gemini' ? callGemini : callOpenAI)(buildUserPrompt(alert)));
    if (!text) throw new Error('Empty LLM response');
    return { message: text, source: 'ai' };
  } catch (err) {
    logger.warn(`LLM failed for ${alert.apiName}, using fallback: ${err.message}`);
    return { message: fallbackMessage(alert), source: 'fallback' };
  }
}

module.exports = { generateAlert, fallbackMessage, SYSTEM_PROMPT, buildUserPrompt };
