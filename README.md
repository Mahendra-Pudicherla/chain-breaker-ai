# Chain Breaker AI

## Problem Statement

**Intelligent Web Application Vulnerability Detection & Analysis Platform**

Chain Breaker AI is a full-stack platform for **authorized** security testing of live web applications. It discovers reachable URLs, runs modular HTTP and browser-assisted checks, persists findings and sitemap data, and presents results through a modern dashboard with live scan progress, history, and exportable reports.

---

## Features

| Feature | Description |
|--------|-------------|
| **Live URL scan** | Crawl and test **live URLs** and endpoints: HTTP crawler plus optional Playwright-based discovery for JavaScript-heavy pages |
| **Modular vulnerability checks** | Pluggable modules (security headers, auth heuristics, reflection, SQLi/XSS probes, CSRF heuristics, IDOR-style path tests, sensitive-data patterns, RBAC role comparison) orchestrated in a fixed pipeline |
| **Dashboard** | Overview of scans, severity distribution, and activity (Recharts visualizations) |
| **History & reports** | Full scan history, per-scan live view, detailed report page with filtering and PDF export |
| **Guided auth capture** | Backend-assisted session for capturing cookies/headers for authenticated scans (when using the API) |
| **Optional AI layer** | Claude API can enrich individual findings and generate an executive scan summary (requires API key) |
| **Modern UI** | React + TypeScript + Tailwind CSS + shadcn/ui — responsive, accessible components |
| **RESTful API** | Node.js HTTP server with JSON endpoints for scans, findings, nodes, live status, and auth-capture flows |
| **Safety & ethics** | Target URL validation (e.g. blocking common private ranges), ownership confirmation in the UI, and gating of intrusive active tests unless policy allows |

---

## Tech Stack

### Frontend

- **React** (TypeScript) — Component-based UI  
- **Vite** — Build tool and dev server  
- **Tailwind CSS** — Utility-first styling  
- **shadcn/ui** + **Radix UI** — Accessible primitives  
- **React Router** — Client-side routing  
- **TanStack Query** — Server/async state  
- **Zustand** — Lightweight client state  
- **Firebase (Web SDK)** — Authentication (and optional Firestore when backend API is not used)  
- **Recharts** — Dashboard charts  
- **`fetch`** — REST calls to the backend API when `VITE_API_BASE_URL` is set  

### Backend

- **Node.js** (ES modules) — Runtime  
- **`node:http`** — Native HTTP server (no Express requirement for core server)  
- **SQLite** (`node:sqlite`) — Persistent storage for scans, queue, nodes, findings, auth sessions  
- **Scan orchestrator** — Queued jobs, sequential module execution, progress updates  
- **HTTP crawler** — `fetch`-based link discovery and response capture  
- **Playwright** — Browser worker for dynamic link discovery (where configured)  
- **Optional integrations** — Anthropic Claude (enrichment/summary), Resend (email on completion) via environment variables  

---

## Project Structure

```
chain-breaker-ai/
├── backend/
│   ├── src/
│   │   ├── server.main.js              # HTTP server, routes, CORS, rate limiting
│   │   ├── storage/
│   │   │   └── database.js             # SQLite DDL, CRUD, queue, legacy JSON migration
│   │   ├── scan/
│   │   │   ├── orchestrator.js         # Scan pipeline & progress
│   │   │   ├── httpCrawler.js          # URL crawl & node building
│   │   │   ├── browserWorker.js        # Playwright discovery
│   │   │   └── modules/                # Vulnerability / analysis modules
│   │   │       ├── securityHeaders.js
│   │   │       ├── authChecks.js
│   │   │       ├── reflectionChecks.js
│   │   │       ├── sqlInjection.js
│   │   │       ├── xssReflected.js
│   │   │       ├── csrfChecks.js
│   │   │       ├── idorChecks.js
│   │   │       ├── sensitiveData.js
│   │   │       ├── rbacTester.js
│   │   │       ├── aiEnricher.js
│   │   │       ├── aiSummary.js
│   │   │       └── emailNotifier.js
│   │   ├── services/
│   │   │   └── authCapture.js          # Guided auth capture helpers
│   │   └── utils/
│   │       ├── logger.js
│   │       └── safety.js               # URL policy, scope, active-test gating
│   ├── data/                           # scanner.db (created at runtime; gitignored)
│   ├── example.env                     # Backend env template
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                     # Routes & providers
│   │   ├── main.tsx
│   │   ├── index.css                   # Design tokens & global styles
│   │   ├── pages/                      # Landing, Auth, Dashboard, NewScan, LiveScan, Report, ScanHistory, Settings, NotFound
│   │   ├── components/                 # Layout, charts, scan UI, shadcn/ui
│   │   ├── lib/                        # firebase.ts, firestore.ts (API/Firestore abstraction)
│   │   ├── store/                      # authStore, scanStore, uiStore
│   │   └── types/
│   ├── public/
│   ├── index.html
│   ├── example.env
│   └── package.json
│
├── cursor.rules                        # AI/agent implementation rules for this repo
└── README.md                           # This file
```

---

## Installation & Setup

### Prerequisites

- **Node.js** 18+ (recommended; Node 20+ if using `node:sqlite` as in current backend)  
- **npm** (or **bun** where you already use it for the frontend)  
- **Playwright** browser binaries (if you rely on `browserWorker.js` in production)  
- **Firebase project** (for Auth; optional Firestore if not using backend API for scan data)  

### 1. Clone the repository

```bash
git clone https://github.com/<your-org>/chain-breaker-ai.git
cd chain-breaker-ai
```

### 2. Run backend + frontend together (recommended)

From the **repo root**, after configuring `frontend/.env` and `backend/.env`:

```bash
npm install
npm run dev
```

This starts the API and the Vite app so the dashboard can load scans (`VITE_API_BASE_URL` must match the backend port).

### 3. Backend setup (standalone)

```bash
cd backend
cp example.env .env
# Edit .env: PORT, optional FIREBASE_*, CLAUDE_API_KEY, RESEND_*, etc.
npm install   # if you add dependencies; core server runs on Node built-ins + sqlite
npm run dev
```

Backend default: `http://127.0.0.1:5000` (or `PORT` from `.env`).

Health check: `GET http://127.0.0.1:5000/health`

### 4. Frontend setup (standalone)

```bash
cd frontend
cp example.env .env
# Set VITE_FIREBASE_* and VITE_API_BASE_URL=http://localhost:5000 for live scans
npm install
npm run dev
```

Frontend dev server: typically `http://localhost:8080` (see Vite output).

---

## How It Works

### External (live URL) scan flow

1. User signs in (Firebase Auth) and starts a scan from **New Scan** (target URL, profile, optional auth, ownership confirmation).  
2. Frontend calls **`POST /api/scans`** with scan payload when `VITE_API_BASE_URL` is set.  
3. Backend validates the target (`safety.js`), stores the scan in **SQLite**, enqueues work, and the **orchestrator** runs:  
   - HTTP crawl → browser discovery (if applicable) → merge **nodes**  
   - Run each **module** in order; append **findings**  
   - Optional **AI enrichment** and **summary**; optional **email** notification  
4. Frontend **polls** `GET /api/scans/:id`, `.../findings`, `.../nodes`, `.../live` for live updates.  
5. **Report** and **Scan History** read the same API (or Firestore path if API URL is unset).

### Dashboard flow

- Lists scans for the signed-in user (via API `userId` query or Firestore listeners).  
- Charts summarize severity and volume using **Recharts** and stored **stats**.

### History flow

- All completed scans remain in **SQLite** (or Firestore in alternate mode) with timestamps, status, and aggregated severity counts.

---

## Scalability

- The API process can be **containerized** and scaled horizontally behind a load balancer; ensure **one writer** per SQLite file or migrate to **PostgreSQL** / a shared store.  
- The current orchestrator processes the queue **serially** per worker instance; for heavy load, introduce a **job queue** (e.g. BullMQ, Redis, or cloud queues) and multiple workers.  
- Frontend is a **static SPA** after `npm run build` and can be served from any CDN or object storage.  

---

## Feasibility

Chain Breaker AI builds on **stable, mainstream** pieces: React, Node.js, SQLite, and standard HTTP. Scan logic is **transparent** (inspect `backend/src/scan/modules/`) and can be extended without replacing the whole stack. Optional AI and email are **additive** and degrade gracefully when keys are absent.

---

## Novelty

Many tools split **DAST** (dynamic testing) and **reporting** across separate products or CLIs. This project combines **guided configuration**, **live progress**, **structured findings**, **sitemap-style discovery**, and **optional AI narration** in one product-style UI, with a **single REST surface** suitable for future CI integration.

---

## Feature depth

- **Severity** levels align with the app’s finding model (e.g. critical → info).  
- **History** retains scan metadata, nodes, and findings for replay and reporting.  
- **API-first**: automation can create scans and poll results without the browser.  
- **Static source code analysis** (e.g. Semgrep) is **not** part of this repository; the focus is **live web targets**. Such a feature could be added as a separate service or future module.

---

## Ethical use & disclaimer

**Chain Breaker AI is for educational, research, and authorized security testing only.**

Do **not** use this tool to scan or test any system, website, or network **without explicit written permission** from the owner. Unauthorized use may violate laws including the **Computer Fraud and Abuse Act (CFAA)** and comparable rules in your jurisdiction.

Use responsibly, ethically, and within legal boundaries.
