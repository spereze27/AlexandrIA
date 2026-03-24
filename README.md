# FormBuilder — Electrical Installation Forms Platform

AI-powered form builder for field inspection workflows, inspired by GoCanvas. Build forms manually via drag-and-drop or generate them from natural language descriptions using a LangGraph agent powered by Gemini 2.5 Flash.

## Features

- **Manual Form Builder** — Drag-and-drop widgets: text, number, single/multi select, photo capture, GPS, signature, date
- **AI Form Generator** — Describe your form in natural language → LangGraph agent extracts sections, classifies fields, structures the schema, and validates it
- **Bilingual Support** — Spanish/English toggle on all forms
- **Google Sheets Integration** — Each form auto-creates a linked Google Sheet; submissions sync automatically
- **Dashboard with Maps** — Google Maps showing inspection points with traffic-light severity markers (green/yellow/red)
- **Offline PWA** — Technicians can fill forms without internet; submissions sync when reconnected
- **Google OAuth** — Secure login with Google accounts
- **Infrastructure as Code** — Full GCP deployment via Terraform
- **CI/CD** — GitHub Actions auto-deploys on push to main

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS |
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2.0 |
| AI Agent | LangGraph · LangChain · Gemini 2.5 Flash |
| Database | PostgreSQL 15 (Cloud SQL) |
| Storage | Google Cloud Storage |
| Auth | Google OAuth 2.0 · JWT |
| Infra | GCP Cloud Run · Terraform · GitHub Actions |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   GitHub Actions                     │
│              Push → Build → Deploy                   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                 Google Cloud Platform                │
│                                                      │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │   Frontend    │────▶│     Backend (FastAPI)     │  │
│  │  (Cloud Run)  │     │       (Cloud Run)         │  │
│  │  React + PWA  │     │  ┌────────────────────┐  │  │
│  └──────────────┘     │  │  LangGraph Agent    │  │  │
│                        │  │  parse → classify   │  │  │
│                        │  │  → structure → val. │  │  │
│                        │  └────────────────────┘  │  │
│                        └─────┬──────┬─────┬───────┘  │
│                              │      │     │          │
│  ┌───────────────┐  ┌───────▼┐  ┌──▼──┐ ┌▼────────┐│
│  │ Secret Manager│  │Cloud   │  │Cloud│ │Google   ││
│  │               │  │SQL     │  │Stor.│ │Sheets   ││
│  └───────────────┘  │(Pg 15) │  │     │ │API      ││
│                      └────────┘  └─────┘ └─────────┘│
└──────────────────────────────────────────────────────┘
```

## Quick Start (Local Development)

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker (for PostgreSQL)
- Google Cloud account with a project
- Gemini API key

### 1. Clone and setup

```bash
git clone https://github.com/your-org/formbuilder-gcp.git
cd formbuilder-gcp
```

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
```

### 3. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env with your API keys

python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Run migrations
alembic revision --autogenerate -m "Initial tables"
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend setup

```bash
cd frontend
npm install

# Create .env.local with:
# VITE_API_URL=http://localhost:8000/api
# VITE_GOOGLE_MAPS_API_KEY=your-maps-key
# VITE_GOOGLE_OAUTH_CLIENT_ID=your-client-id

npm run dev
```

Open http://localhost:5173

## GCP Deployment

### 1. Initial setup

```bash
# Create GCP project and enable billing
gcloud projects create formbuilder-prod
gcloud config set project formbuilder-prod

# Create Terraform state bucket
gsutil mb gs://formbuilder-tfstate
```

### 2. Configure Terraform

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project ID and API keys
```

### 3. Deploy infrastructure

```bash
terraform init
terraform plan
terraform apply
```

### 4. Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

| Secret | Description |
|--------|------------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_REGION` | Region (e.g., `us-central1`) |
| `GCP_SA_KEY` | GitHub Actions service account key (JSON, base64) |
| `GOOGLE_MAPS_API_KEY` | Google Maps JS API key |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth 2.0 client ID |

### 5. Deploy

Push to main branch — GitHub Actions will build and deploy automatically:

- `backend/**` changes → rebuild + deploy backend Cloud Run
- `frontend/**` changes → rebuild + deploy frontend Cloud Run

## LangGraph Agent

The AI agent generates form schemas from natural language through 4 nodes:

1. **parse_requirements** — Extracts sections, fields, languages, and required flags
2. **classify_fields** — Assigns widget types (text, select, photo, GPS, etc.)
3. **structure_form** — Organizes into logical sections with conditional logic
4. **validate_form** — Checks completeness; retries up to 2x if invalid

### Example prompt

```
📋 FORMULARIO SITE SURVEY
POLE TRANSFER + POLE REMOVAL

🔹 1. IDENTIFICACIÓN / IDENTIFICATION
Pole ID (del Excel) / Pole ID (from spreadsheet)
Dirección / Address
GPS automático / Auto GPS location
📸 Foto general del poste / General pole photo (required)

🔹 2. ESTADO DEL POSTE / POLE STATUS
Seleccionar una / Select one:
- Pendiente transferencia + retiro
- Ya transferido – falta retirar poste
- Ya hecho (no requiere trabajo)
...
```

The agent produces a complete JSON schema with bilingual labels, field types, validations, and conditional logic.

## Dashboard

Each form has a dashboard showing:

- **KPI cards** — Total submissions, ready, review, not executable, pending
- **Google Maps** — Poles plotted by GPS with color-coded markers:
  - 🟢 Green: Ready for execution, no issues
  - 🟡 Yellow: Requires review or medium complexity
  - 🔴 Red: Not executable, high complexity, or critical issues
  - ⚪ Gray: No data / not found
- **Filters** — By severity and status
- **Google Sheet link** — Direct access to raw data

## Offline Support (PWA)

The frontend is a Progressive Web App:

- Form schemas are cached in the Service Worker
- Submissions are stored in IndexedDB when offline
- Auto-syncs pending submissions when connection returns
- Batch sync endpoint prevents duplicates via `client_id`
- Install on mobile home screen for native-like experience

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/google` | Login with Google OAuth |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/forms/` | List forms |
| POST | `/api/forms/` | Create form (auto-creates Sheet) |
| GET | `/api/forms/:id` | Get form with schema |
| GET | `/api/forms/:id/public` | Public form schema (no auth) |
| PATCH | `/api/forms/:id` | Update form |
| POST | `/api/submissions/` | Submit form |
| POST | `/api/submissions/batch` | Batch sync offline submissions |
| POST | `/api/submissions/:id/media` | Upload photo/signature |
| POST | `/api/agent/generate` | Generate form from prompt |
| GET | `/api/dashboard/:formId` | Dashboard data + map points |

## License

Proprietary — All rights reserved.
