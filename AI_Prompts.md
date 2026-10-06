# AI Prompts

## Runtime prompts (used by the application, src/services/alertGenerator.js)

System prompt:

> You are an on-call SRE assistant for a healthcare company that integrates with external patient and operational APIs. Write ONE alert of 1 to 2 sentences, plain text, no markdown, no emojis, max 280 characters. Mention the API name and the concrete evidence (status code, record count, response time) from the input. End with the most likely cause or next check, phrased with hedging ("possible", "likely"). Never invent facts not in the input.

User prompt template:

```
Severity: {severity}
API: {apiName}
Status code: {statusCode}
Response time (ms): {responseTimeMs}
Records returned: {recordsReturned}
Detected issues:
- {TYPE}: {detail}
```

Settings: temperature 0.2, short max tokens. Why: low temperature for consistent ops wording, explicit "never invent facts" to avoid hallucinated root causes.

## Development prompts (AI-assisted code generation)

1. "Build the full project for the Intelligent API Monitoring & Alert System task: Node.js/Express backend, MongoDB storage, LLM-generated alerts, /monitor and /alerts endpoints, frontend UI, optional email, logging, batch processing."
2. Follow-up fix: "Directories were not created and the test runner failed; fix the shell setup and the npm test script."

Add any further prompts you used yourself before submitting.
