# ScanMan2 — Tenable SC Query Canvas

ScanMan2 is a high-performance, professional vulnerability dashboard for Tenable Security Center (SC). It features a flexible drag-and-drop interface, advanced reporting visualizations (ECharts-inspired), and a persistent scheduling system for automated email reports.

## 🏗️ Architecture

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Browser        │──────▶│  Nginx (frontend) │──────▶│  FastAPI Proxy   │──────▶ Tenable SC
│   React SPA      │ :80/443│  /api/ → :8000    │  :8000│  (internal net)  │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

The frontend acts as a single point of entry on port 80 (or 443), reverse-proxying all API requests to the backend container internally within the Docker network.

---

## 📂 Project Structure

```
├── docker-compose.yml          # Standard deployment (HTTP)
├── docker-compose.ssl.yml      # SSL/HTTPS override
├── Dockerfile                  # Frontend: Node build → Nginx
├── Dockerfile.ssl              # Frontend with SSL support
├── nginx.conf                  # SPA routing + /api/ reverse proxy
├── nginx-ssl.conf              # SSL-enabled Nginx config
├── certs/                      # Directory for SSL certificates
├── src/                        # React Frontend
│   ├── components/dashboard/   # Advanced Widget Library & Scheduling UI
│   ├── hooks/                  # State Management (ScanMan2 store)
│   ├── lib/                    # API client, chart utils, time utils
│   └── pages/                  # Main Index and Layout
└── fastapi-backend/            # Python Backend
    ├── main.py                 # Production Proxy + Scheduler
    ├── demo_backend.py         # Mock backend for demo mode
    ├── schedules.json          # Persistent store for scheduled reports
    ├── requirements.txt        # Dependencies (FastAPI, APScheduler, etc.)
    └── .env                    # Environment configuration
```

---

## 🚀 Quick Start (Docker / Recommended)

The easiest way to run ScanMan2 is using Docker Compose.

```bash
# 1. Clone and enter the project
# 2. Configure Tenable SC credentials (optional for demo mode)
cp fastapi-backend/.env.example fastapi-backend/.env
# Edit .env with your TENABLE_SC_HOST and API keys

# 3. Build and run
docker compose up -d

# Dashboard: http://localhost
# API Health: http://localhost/health
```

*Note: By default, the backend runs in **Demo Mode**. To connect to your real Tenable SC instance, change `BACKEND_MODULE=main` in `docker-compose.yml`.*

---

## 🛠️ Local Development (Without Docker)

### 1. Backend (FastAPI)
```bash
cd fastapi-backend
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the proxy (use --reload for development)
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend (React + Vite)
```bash
# In the project root
npm install
npm run dev
```
*   **Dev URL:** `http://localhost:8080`
*   **Config:** Open the **Settings Panel** (Server icon in top right) and set the API URL to `http://localhost:8000` to point at your local backend.

---

## 🛡️ Production & SSL Configuration

For production, it is highly recommended to run ScanMan2 over HTTPS.

### 1. Configure SSL for Frontend (Nginx)
The frontend container handles SSL termination for both the web app and the API proxy.

1.  **Prepare Certificates:** Place your `fullchain.pem` and `privkey.pem` in the `./certs/` directory.
2.  **Run with SSL Override:**
    ```bash
    docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d
    ```
    This maps ports **80** (redirects to 443) and **443** to your host.

---

## 📅 Scheduled Reports & SMTP

ScanMan2 uses **APScheduler** to manage automated reporting.

**Configuration (.env):**
| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | Outgoing mail server (e.g., `smtp.gmail.com`). |
| `SMTP_PORT` | SMTP Port (usually `587` or `465`). |
| `SMTP_USER` | Username for email authentication. |
| `SMTP_PASS` | Password or App Password for email. |
| `SMTP_FROM` | The sender address for reports. |
| `SMTP_TLS` | Set to `true` to use TLS (recommended). |

**Persistence:**
All schedules are saved to `fastapi-backend/schedules.json`. This ensures that if the system restarts, your reports are automatically reloaded and executed on time.

---

## 📊 Advanced Reporting Widgets

ScanMan2 includes high-performance, ECharts-inspired visualizations:

-   **Heatmap Matrix:** Density grid for identifying high-risk hotspots.
-   **Sunburst Chart:** Hierarchical nested rings for deep-dive distribution.
-   **Advanced Sankey:** Multi-level data flows (IP → Severity → Family).
-   **Divergent Bar:** Side-by-side comparison (Positive vs. Negative values).
-   **Grouped-Stack Bar:** Mix standalone total bars with stacked severity.
-   **Table Virtualization:** Zero-lag performance for thousands of records.
-   **Export:** PDF (Portrait/Landscape), CSV (with headers), and JSON.
