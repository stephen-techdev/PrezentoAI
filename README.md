# Prezento AI

**Professional AI Presentations. Completely Free.**

Prezento AI arranges **your own content** into beautiful, well-structured slide decks — then lets you edit, restyle, and export to PPTX or PDF. No subscriptions, no paid APIs, no API keys. Generation runs on local open-source models through [Ollama](https://ollama.com) with an offline fallback, so the app works even with no backend running.

---

## How to use (user guide)

### 1. Describe your deck
On the home screen, write what you want. Best results come from an outline:
```
Slide 1: Title
Slide 2: What we built
- point one
- point two
Slide 3: Thank You
```
Extra lines like "Use a modern style" or "add visuals" are treated as **design instructions** — they style the deck and never appear as slide text.

### 2. Review the outline
Before generating, every detected slide appears as an editable card. Fix titles, rewrite bullets (one per line), delete slides, or add new ones. What you approve here is exactly what gets arranged — nothing is invented or dropped.

### 3. Pick a theme, then Generate
Choose one of 10 themes, a background, and your audience. Bullets automatically become **tables, cards, process steps, timelines, statistics, comparisons, or quotes** wherever they fit — instead of plain bullet walls.

### 4. Edit visually
Click any text to edit it inline. The Properties panel (right side) offers fonts, custom colors (any hex code), gradients, shapes, and alignment. Upload images or a logo from your device — the logo pins itself to the top-right corner.

### 5. Command the AI chat (any language)
Open the AI Assistant in the editor and type what you want — English, Spanish, French, German, Hindi, Tamil, Arabic and more. Chain commands with "then".

**Restructure slides:**
- "make this slide a table" · "convert bullets to cards" · "show this as a timeline" · "turn these points into steps" · "make it visual" / "redesign this slide"

**Style & design:**
- "change all backgrounds to light blue" · "make the title bigger" · "center the title" · "apply the dark theme" · "make the text bold"

**Slides & content:**
- "add a slide then change its title to Pricing" · "duplicate slide 2" / "delete slide 5" · "remove "old text"" / "replace "old" with "new"" · "add an image about teamwork"

**Polish text:**
- "rewrite this professionally" · "shorten the body" · "fix the grammar"

Numbers, "slide N", color names, hex codes, and "quoted text" work in every language. Destructive actions ask for confirmation first. Press **Guide** in the navbar or dashboard for this reference inside the app.

### 6. Present & export
Present in the browser, or export to PPTX (PowerPoint) and PDF with formatting preserved. Check your **Presentation Score**, auto-generated **Speaker Notes**, and **Viva Q&A** before you deliver.

---

## Free forever — for users and developers

- Unlimited generations. No credits, subscriptions, or credit card.
- No paid AI APIs. All AI runs on free local open-source models (Ollama) with a built-in offline fallback.
- Works offline: the editor, chat fallback, and PPTX/PDF export run entirely in the browser.
- Cloud sync via Supabase (free tier) is optional — sign in to save decks online, or just export files locally.
- Every dependency (npm + pip) is free and open-source. Nothing to buy, nothing to license.

---

## Features

- **AI generation** — arrange your own outline into a full deck (prompt is the content; nothing invented, nothing dropped)
- **Outline review** — edit every detected slide as a card before generating
- **AI chat editor** — restyle, restructure (table/cards/timeline/steps), and rewrite slides in any language; chain commands with "then"
- **14+ slide layouts** — hero, agenda, two-column, cards, statistics, timeline, process, comparison, grid, table, chart, quote, image-right, diagram, section-divider, thank-you
- **Inline editing** — click any text to edit; add, duplicate, reorder, delete slides
- **10 built-in themes** — switch instantly without losing content
- **AI rewrite** — 8 tones (rewrite, shorten, expand, simplify, professional, academic, business, friendly)
- **AI regenerate** — refresh a single slide or the whole deck
- **Speaker notes** — auto-generated per slide
- **Viva assistant** — expected questions, answers, and follow-ups
- **Presentation score** — content, design, readability, visual balance, grammar, flow
- **Chart.js** — bar, line, doughnut, and pie charts on data slides
- **Export** — PPTX (python-pptx) and PDF (reportlab), formatting preserved
- **Dark mode** — full light/dark theme support
- **Responsive** — mobile to desktop

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Charts | Chart.js |
| Icons | Lucide React |
| Backend | FastAPI (Python) |
| Database | SQLite |
| AI | Ollama (Qwen 2.5, Llama 3, Gemma, etc.) |
| PPTX export | python-pptx |
| PDF export | reportlab |

---

## Project Structure

```
prezento/
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── ai/               # Ollama client + prompts
│   │   ├── database/         # SQLite connection + schema
│   │   ├── exporter/         # PPTX + PDF exporters
│   │   ├── models/           # Pydantic schemas
│   │   ├── services/         # Generator, storage
│   │   ├── config.py
│   │   ├── main.py
│   │   └── themes_compat.py
│   ├── data/                 # SQLite database (created at runtime)
│   ├── scripts/
│   │   └── pull_model.sh
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── requirements.txt
│   └── .env.example
├── src/                      # React frontend
│   ├── components/
│   │   ├── AIPanel.tsx
│   │   ├── ChartCanvas.tsx
│   │   ├── Editor.tsx
│   │   ├── GeneratingScreen.tsx
│   │   ├── Landing.tsx
│   │   ├── SettingsPanel.tsx
│   │   └── SlideRenderer.tsx
│   ├── lib/
│   │   ├── api.ts            # Backend API client with fallback
│   │   ├── exporter.ts       # Client-side export fallback
│   │   ├── generator.ts      # Local in-browser generator
│   │   ├── icons.ts
│   │   └── id.ts
│   ├── App.tsx
│   ├── main.tsx
│   ├── types.ts
│   ├── themes.ts
│   └── index.css
├── public/
│   └── favicon.svg
├── Dockerfile.frontend
├── docker-compose.yml
├── nginx.conf
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── .env.example
└── README.md
```

---

## Quick Start (Docker)

The fastest way to run the full stack (Ollama + backend + frontend):

```bash
# 1. Copy env files
cp backend/.env.example backend/.env
cp .env.example .env

# 2. Build and start everything
docker compose up --build

# 3. In another terminal, pull the AI model (one-time)
docker exec -it prezento-ollama ollama pull qwen2.5:3b
```

Then open:
- **Frontend:** http://localhost:5173
- **API docs:** http://localhost:8000/docs
- **Ollama:** http://localhost:11434

---

## Manual Setup (Local Development)

### 1. Install Ollama and pull a model

```bash
# Install from https://ollama.com
ollama pull qwen2.5:3b
# Alternatives: llama3.2:3b, gemma2:2b, phi3:3.8b, mistral:7b
```

### 2. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
./entrypoint.sh                  # or: uvicorn app.main:app --reload
```

The API runs on http://localhost:8000. Open http://localhost:8000/docs for Swagger UI.

### 3. Start the frontend

```bash
# From the project root
npm install
cp .env.example .env
npm run dev
```

The app runs on http://localhost:5173.

> **Note:** The frontend works even without the backend. If the backend is unreachable, it falls back to a built-in local generator and client-side export. To use the full Ollama-powered AI, start the backend.

---

## Build

```bash
# Frontend production build
npm run build

# Preview the production build
npm run preview

# Type-check
npm run typecheck

# Lint
npm run lint
```

The build output is in `dist/`.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check + Ollama status |
| POST | `/api/generate` | Generate a presentation from settings |
| POST | `/api/rewrite` | Rewrite text with a given tone |
| POST | `/api/viva/{id}` | Generate viva questions for a saved presentation |
| POST | `/api/score` | Score a presentation |
| POST | `/api/export` | Export as PPTX or PDF (returns file) |
| GET | `/api/presentations` | List saved presentations |
| GET | `/api/presentations/{id}` | Fetch a saved presentation |
| DELETE | `/api/presentations/{id}` | Delete a saved presentation |

---

## Configuration

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `DEBUG` | `false` | Enable auto-reload |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed CORS origins |
| `DATABASE_URL` | `sqlite:///./data/prezento.db` | SQLite path |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Model name |
| `OLLAMA_TIMEOUT` | `120` | Request timeout (seconds) |

### Frontend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend URL |
| `VITE_SUPABASE_URL` | — | Optional Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | — | Optional Supabase anon key |

---

## How the AI Works

Prezento AI uses **Ollama** to run AI models entirely on your machine — no API keys, no per-request fees.

1. The frontend sends the user's prompt + settings to the backend.
2. The backend builds a structured prompt and sends it to Ollama.
3. Ollama returns a JSON object describing the slides.
4. The backend validates it with Pydantic and persists it to SQLite.
5. If Ollama is unavailable, the backend falls back to a deterministic local template engine so the app always returns a usable deck.

Recommended models (all free):
- `qwen2.5:3b` — fast, good quality (default)
- `llama3.2:3b` — Meta's compact model
- `gemma2:2b` — Google's compact model
- `phi3:3.8b` — Microsoft's compact model
- `mistral:7b` — higher quality, needs more RAM

---

## License

MIT License — see [LICENSE](LICENSE).
