# StudySphere

**Smart MCA Assistant using RAG and Generative AI.**

StudySphere is a college-focused study assistant for MCA students. Upload your
notes, PDFs, PPTs, and previous papers, then ask questions in plain English and
get answers grounded in *your own* material — complete with source citations.

It combines **RAG (Retrieval-Augmented Generation)**, **NLP**, a **vector
retrieval engine**, **web development**, **user accounts & payments**, and
**education technology** into one project, with a clean red-and-white interface.

## 🔐 Accounts, Modes & Credits

StudySphere has a **free offline tier** and a **paid online (premium) tier**:

| Mode | Engine | Cost | Needs |
| --- | --- | --- | --- |
| **Offline** (Free) | Local TF-IDF retrieval | Free, unlimited | An account |
| **Online** (Premium) | Claude API | Spends **AI credits** | Credits + server API key |

**Plans:** Free (₹0, offline + 10 trial credits) · Starter ₹99 / 50 credits ·
Pro ₹199 / 150 · Premium ₹399 / 500. Credits **stack and never expire**.
Payments use **Razorpay** (with a mock flow when keys aren't set).

Every user has their own account (JWT auth) and their **own private** uploads,
chats, and credits. See `docs/premium-architecture.md` for the full design.

---

## ✨ Features

| Feature | What it does |
| --- | --- |
| **Upload System** | Ingests PDF, DOCX, TXT, MD — chunked, page-tracked, and indexed instantly. |
| **Ask Your Notes (RAG Chat)** | Conversational answers generated from your material, with **source citations** (file + page). |
| **Semester-wise Knowledge Base** | Tag uploads by semester/subject/type; browse and manage your library. |
| **Notes Summarizer** | Turns long PDFs into a key-concepts revision sheet. |
| **Quiz Generator** | Auto-creates interactive MCQs (with answers & explanations) on any topic. |
| **Question Paper Generator** | Builds university-pattern papers (Section A/B/C with marks). |
| **Revision Planner** | Day-by-day exam-prep schedule from your notes. |
| **Previous Paper Analysis** | Finds the most-repeated topics across question papers (frequency chart). |
| **Voice Assistant** | Ask questions by voice (browser Web Speech API). |
| **Source Citations** | Every answer shows where it came from — trustworthy by design. |

---

## 🏗 Architecture

```
            PDF / DOCX / TXT
                   │
            Document Loader  (text extraction + page tracking)
                   │
            Text Chunking    (overlapping, page-aware)
                   │
            TF-IDF Vectors   (pure-Python embeddings)
                   │
        ┌──────────┴───────────┐
   Vector Store           SQLite (files, chunks, history)
        │
  Query → Retriever → Top Chunks → Claude (Anthropic) → Cited Answer
                                       │
                            (offline fallback if no API key)
```

### Tech stack
- **Backend:** Python · FastAPI
- **AI layer:** Anthropic Claude API (official SDK) — *optional*
- **RAG / Vector search:** custom TF-IDF cosine retrieval (no heavy native deps)
- **Database:** SQLite (standard library)
- **Frontend:** HTML / CSS / vanilla JS (single-page app), red & white theme,
  served directly by FastAPI

> **Works with or without an API key.** Set `ANTHROPIC_API_KEY` for AI-written
> answers, quizzes, summaries, and papers. Without one, StudySphere still runs
> fully and answers from your notes using its built-in retrieval engine.

---

## 🚀 Getting Started

The app is now a **React (Vite) frontend + FastAPI backend** — run both.

**1) Backend** (terminal 1):
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# optional: enable online (AI) mode and real payments
copy .env.example .env   # add ANTHROPIC_API_KEY and Razorpay keys

python app/main.py       # http://127.0.0.1:8000  (API + /docs)
```

**2) Frontend** (terminal 2):
```powershell
cd frontend
npm install
npm run dev              # http://localhost:5173  ← open this
```

Open **http://localhost:5173**, create an account (you get 10 free credits), and
start uploading notes. Without an `ANTHROPIC_API_KEY`, online mode is disabled and
everything runs in free offline mode; without Razorpay keys, upgrades use a mock
flow that credits your account instantly.

> On macOS/Linux use `source .venv/bin/activate` and `cp .env.example .env`.

### Environment keys (`backend/.env`)

| Key | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Enables online (Claude) mode |
| `STUDYSPHERE_MODEL` | Model id (default `claude-opus-4-8`) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Real Razorpay payments (else mock) |
| `JWT_SECRET` | Token signing secret (auto-generated if blank) |

---

## 📡 API Overview

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` · `/api/auth/login` | — | Create account / log in (JWT) |
| `GET`  | `/api/auth/me` | ✓ | Current user (plan, credits) |
| `GET`  | `/api/config` | — | Plans, credit costs, flags |
| `POST` | `/api/upload` | ✓ | Upload & index a file (per-user) |
| `GET`/`DELETE` | `/api/files` `/api/files/{id}` | ✓ | Manage own files |
| `POST` | `/api/chat` | ✓ | RAG chat (mode-aware, metered) |
| `GET`  | `/api/history` · `/api/me/stats` | ✓ | History / dashboard stats |
| `POST` | `/api/summarize` `/quiz` `/question-paper` `/revision-plan` `/analyze-papers` | ✓ | Study tools (metered) |
| `GET`  | `/api/payments/plans` | — | Plan catalogue |
| `POST` | `/api/payments/create-order` · `/api/payments/verify` | ✓ | Razorpay purchase flow |

---

## ☁️ Deployment

StudySphere deploys as a **single Docker service**: the React app is built and
served by FastAPI, so there's one URL, no CORS setup, and one thing to host.

### Deploy to Render (recommended, free)
1. Push this repo to GitHub (already done if you're reading this there).
2. On [render.com](https://render.com): **New + → Blueprint**, pick this repo
   (`render.yaml` is detected automatically).
3. In the service's **Environment** tab, add your secrets:
   - `ANTHROPIC_API_KEY` — for online (AI) mode
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — for real payments (else mock)
   - `JWT_SECRET` is auto-generated by the blueprint.
4. Deploy. Your app is live at `https://studysphere-xxxx.onrender.com`.

> ⚠️ **Persistence:** Render's free filesystem is ephemeral — the SQLite DB
> resets on each deploy/restart. For permanent accounts & uploads, upgrade the
> instance and uncomment the `disk:` block in `render.yaml` (or migrate to
> Postgres). Fine as-is for demos.

### Any Docker host (Railway, Fly.io, a VPS)
```bash
docker build -t studysphere .
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e RAZORPAY_KEY_ID=rzp_test_... -e RAZORPAY_KEY_SECRET=... \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -v studysphere_data:/data \
  studysphere
```
On Railway/Fly, mount a volume at `/data` for a persistent database.

### Notes
- Frontend talks to the API via relative `/api` paths, so it works on any
  domain with zero config when served by the backend.
- Set a fixed `JWT_SECRET` in production so logins survive restarts.
- `JWT_SECRET`, `ANTHROPIC_API_KEY`, and Razorpay keys are **never committed** —
  they live only in host environment variables / your local `.env`.

## 📁 Project Structure

```
StudySphere/
├── backend/                       # FastAPI JSON API
│   ├── app/
│   │   ├── main.py                # app + CORS + lifespan
│   │   ├── api.py                 # auth, metered AI, payment routes
│   │   ├── config.py              # plans, credit costs, secrets
│   │   ├── security.py            # PBKDF2 hashing + JWT
│   │   ├── db.py                  # SQLite (users, credits, per-user data)
│   │   ├── schemas.py             # Pydantic models
│   │   └── services/
│   │       ├── loader.py          # extraction + chunking
│   │       ├── vector_store.py    # per-user TF-IDF retrieval
│   │       ├── ai_service.py      # Claude (online) + offline answers
│   │       ├── study_tools.py     # quiz/paper/plan/summary/analysis
│   │       └── payments.py        # Razorpay orders + verification
│   ├── requirements.txt
│   └── .env.example
├── frontend/                      # React + Vite + TS (red & white UI)
│   └── src/{components,views}/    # auth gate, modes, credits, pricing…
└── docs/
    ├── plan.md                    # original roadmap
    └── premium-architecture.md    # accounts/credits/payments design
```

See `docs/premium-architecture.md` for the accounts, credits, and payments design.
