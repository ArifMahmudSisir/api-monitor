# 🚨 API Monitor — Intelligent Alert System

Ever wonder why your APIs are silently failing at 3am? This project watches your API responses, spots anomalies, and asks an AI to write a clear, human-readable explanation of what went wrong — so your on-call team actually understands the alert.

Built with **Node.js**, **Express**, **MongoDB**, and your choice of **OpenAI** or **Google Gemini**.

---

## ✨ What It Does

- **Monitors** batches of API response data (status codes, response times, record counts)
- **Detects anomalies** like server errors, slow responses, and missing records using configurable thresholds
- **Writes AI-powered alerts** — not just "HTTP 500 error", but *"AppointmentAPI returned a server error with status 500 and 0 records. Possible database outage or downstream service failure."*
- **Deduplicates** intelligently — if the same issue fires 50 times, it bumps a counter instead of spamming you with 50 identical alerts
- **Emails reports** to any address you choose (or falls back gracefully if email isn't configured)
- **Live dashboard** at `http://localhost:5000` that auto-refreshes every 15 seconds

---

## 🗂️ Project Structure

```
api-monitor/
├── src/
│   ├── app.js               # Express app setup
│   ├── server.js            # Entry point, connects to MongoDB
│   ├── config.js            # All environment variable defaults in one place
│   ├── logger.js            # Winston logging
│   ├── routes/
│   │   ├── monitor.js       # POST /monitor — ingest API responses
│   │   └── alerts.js        # GET /alerts — fetch, filter, resolve alerts
│   ├── services/
│   │   ├── detector.js      # Pure anomaly detection rules (no DB, easy to test)
│   │   ├── alertGenerator.js# Calls OpenAI or Gemini, falls back to templates
│   │   ├── monitorService.js# Orchestrates the full pipeline
│   │   └── mailer.js        # Sends SMTP email reports
│   ├── models/
│   │   └── Alert.js         # Mongoose schema for alerts
│   └── middleware/
│       └── errors.js        # Centralized error handling
├── public/
│   └── index.html           # The web dashboard (no build step needed!)
├── data/
│   └── sample.json          # 8 sample API responses to test with
├── test/                    # Unit tests
├── .env                     # Your local configuration (never commit this!)
├── Dockerfile               # Container definition for the Node app
└── docker-compose.yml       # Starts both the app and MongoDB together
```

---

## 🔧 Setup

### Option A — Docker (Recommended, easiest)

You just need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed. That's it.

**1. Clone the repo and enter the folder**
```bash
git clone <your-repo-url>
cd api-monitor
```

**2. Configure your environment**

Open `.env` and fill in your settings. At minimum, add an LLM key so alerts are AI-generated:

```env
# Choose your AI provider
LLM_PROVIDER=openai           # or: gemini
OPENAI_API_KEY=sk-...         # your OpenAI key
# GEMINI_API_KEY=...          # or your Gemini key

# Optional: enable email reports
SMTP_HOST=smtp.gmail.com
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
ALERT_EMAIL_RECIPIENT=alerts@yourcompany.com
```

> 💡 **No LLM key?** No problem — the system still works perfectly and uses template-generated alerts instead.

**3. Start everything**
```bash
docker compose up --build
```

That single command builds the app image and starts both the Node.js server and MongoDB. Done!

---

### Option B — Run Locally (without Docker)

You'll need **Node.js 18+** and a running **MongoDB** instance.

**1. Install dependencies**
```bash
npm install
```

**2. Configure `.env`** (same as above)

**3. Start the server**
```bash
npm start
```

---

## 🚀 Running the App

### Open the Dashboard

Once running, open your browser and go to:

```
http://localhost:5000
```

You'll see the live alert dashboard. It auto-refreshes every 15 seconds.

### Try It Out Instantly

Click **"Run sample data"** in the dashboard sidebar — this will process the 8 pre-built API responses in `data/sample.json` and immediately show the resulting alerts.

### Submit Your Own API Responses

Paste a JSON array into the text area in the sidebar and click **"Analyze responses"**. Each entry should look like:

```json
[
  {
    "api_name": "PaymentsAPI",
    "response_time_ms": 6200,
    "status_code": 500,
    "records_returned": 0
  }
]
```

### Send Alerts by Email

Check the **"Email the anomaly report"** checkbox before submitting. You can also type a custom recipient email in the input box next to it — leave it blank to use the default from `.env`.

---

## 🔌 REST API

If you prefer `curl` over the UI:

```bash
# Analyze a batch of API responses
curl -X POST http://localhost:5000/monitor \
  -H "Content-Type: application/json" \
  -d @data/sample.json

# Run the built-in sample data
curl -X POST "http://localhost:5000/monitor/sample"

# Run sample data AND email the report
curl -X POST "http://localhost:5000/monitor/sample?email=true"

# Send to a specific email address
curl -X POST "http://localhost:5000/monitor/sample?email=true&recipient=you@example.com"

# Get all active alerts
curl http://localhost:5000/alerts

# Filter by severity
curl "http://localhost:5000/alerts?severity=critical"

# Get alert counts by severity
curl http://localhost:5000/alerts/stats

# Resolve an alert
curl -X PATCH http://localhost:5000/alerts/<id>/resolve

# Health check
curl http://localhost:5000/health
```

---

## 🔍 Anomaly Detection Rules

The detector flags these conditions automatically. All thresholds are configurable in `.env`.

| What it detects | Issue Type | Severity |
|---|---|---|
| HTTP 5xx server error | `FAILED_REQUEST` | 🔴 Critical |
| HTTP 4xx client error | `CLIENT_ERROR` | 🟠 High |
| Response time ≥ `CRITICAL_MS` (default 5000ms) | `HIGH_RESPONSE_TIME` | 🟠 High |
| 0 records returned on a 2xx response | `NO_RECORDS` | 🟠 High |
| Response time ≥ `SLOW_MS` (default 3000ms) | `HIGH_RESPONSE_TIME` | 🟡 Medium |
| Unexpected HTTP status (1xx, 3xx) | `UNEXPECTED_STATUS` | 🔵 Low |
| Negative or missing field values | `INVALID_DATA` | varies |

The final alert severity is the **highest severity** of all detected issues on that API call.

---

## 🧪 Running Tests

```bash
npm test
```

Unit tests cover the core anomaly detection logic in `detector.js`. Since the detector is a pure function with no database or network calls, the tests are fast and reliable.

---

## 📋 Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/api_monitor` |
| `LLM_PROVIDER` | `openai` or `gemini` | `openai` |
| `OPENAI_API_KEY` | Your OpenAI API key | — |
| `GEMINI_API_KEY` | Your Gemini API key | — |
| `SLOW_MS` | Response time threshold for "medium" alert | `3000` |
| `CRITICAL_MS` | Response time threshold for "high" alert | `5000` |
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_USER` | SMTP username / email | — |
| `SMTP_PASS` | SMTP password or app password | — |
| `ALERT_EMAIL_RECIPIENT` | Default alert recipient email | — |

---

## 🛑 Stopping the App

```bash
# Stop the containers (keeps your MongoDB data)
docker compose down

# Stop AND delete all data (fresh start)
docker compose down -v
```

---

> Built as a demonstration of modular, AI-augmented backend design. Contributions welcome!
