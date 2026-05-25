# Apply Ready

> **"LinkedIn shows you everything. Apply Ready gets you ready."**

An AI career recruiter that tells the truth. Fit scores, tailored resumes, cover letters, interview prep, and post-interview debriefs — built around your actual experience, never invented.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Auth + Database | Supabase (Postgres + RLS) |
| File Storage | Supabase Storage |
| AI | Anthropic Claude API (`claude-opus-4-7`) |
| Job Listings | Adzuna API (mock fallback included) |
| Document Generation | `docx` npm library |
| Resume Parsing | `pdf-parse` (PDF), `mammoth` (DOCX) |

---

## Prerequisites

- Node.js 18+
- npm 9+
- [Supabase](https://supabase.com) account (free tier works)
- [Anthropic API key](https://console.anthropic.com)
- [Adzuna API credentials](https://developer.adzuna.com) (optional — mock data is used if absent)

---

## Environment Variables

| Variable | Required | Where | Description |
|----------|----------|-------|-------------|
| `SUPABASE_URL` | Yes | `server/.env` | Project URL from Supabase dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Yes | `server/.env` | Public anon key |
| `SUPABASE_SERVICE_KEY` | Yes | `server/.env` | Service role key — never expose to client |
| `ANTHROPIC_API_KEY` | Yes | `server/.env` | Your Anthropic API key — never expose to client |
| `JOB_API_ID` | No | `server/.env` | Adzuna app ID — omit to use mock data |
| `JOB_API_KEY` | No | `server/.env` | Adzuna app key — omit to use mock data |
| `PORT` | No | `server/.env` | Server port (default: `3001`) |
| `CLIENT_ORIGIN` | No | `server/.env` | CORS origin (default: `http://localhost:5173`) |
| `VITE_SUPABASE_URL` | Yes | `client/.env` | Same as `SUPABASE_URL` — Vite prefix required |
| `VITE_SUPABASE_ANON_KEY` | Yes | `client/.env` | Same as `SUPABASE_ANON_KEY` — Vite prefix required |

---

## Setup

### 1. Install dependencies

```bash
cd apply-ready
npm install
```

### 2. Configure environment variables

```bash
# Server env
cp .env.example server/.env
# Edit server/.env and fill in all required values

# Client env (only needs VITE_ vars)
cat > client/.env << 'EOF'
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
EOF
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and paste + run the contents of `sql/schema.sql`
3. To enable Google OAuth: **Authentication → Providers → Google** (optional)
4. Create a Storage bucket:
   - Go to **Storage** → **New bucket**
   - Name: `resumes`
   - Set to **Private**
   - Run the storage policy SQL from the bottom of `sql/schema.sql`

### 4. Run in development

```bash
npm run dev
```

This starts both services concurrently:
- Client: [http://localhost:5173](http://localhost:5173)
- Server: [http://localhost:3001](http://localhost:3001)

To run separately:
```bash
npm run dev:server   # server only
npm run dev:client   # client only
```

### 5. Build for production

```bash
npm run build        # builds client/dist
npm run start        # starts the server
```

Serve `client/dist` as static files from your CDN or server. Set `CLIENT_ORIGIN` to your production client URL.

---

## Database Schema

Full schema is in `sql/schema.sql`. Run it once in Supabase SQL Editor.

### Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profile: situation, resume style, target roles/regions, seniority, comp floor, onboarding state |
| `resumes` | Parsed resume text and Supabase Storage reference |
| `jobs` | Shared job listing cache (7-day TTL, keyed by `external_id`) |
| `user_jobs` | Per-user job interactions: status, fit score + report, tailored resume, cover letter, interview prep, debrief, journey status |
| `user_added_jobs` | Metadata for jobs the user added themselves (BYO) |

### Row-Level Security

All user data tables enforce RLS. Users can only read and write their own rows. The `jobs` table is readable by all authenticated users; writes go through the service role (server-side only).

---

## Job API

### Adzuna (default)

Get free API credentials at [developer.adzuna.com](https://developer.adzuna.com). Free tier allows ~100 requests/day.

Set `JOB_API_ID` and `JOB_API_KEY` in `server/.env`.

**Supported regions** (in `server/adapters/adzunaAdapter.js` `REGION_TO_COUNTRIES` map):
- United States, United Kingdom, Canada, Australia, Germany, France, Netherlands, New Zealand, Singapore, India, South Africa, Brazil, Mexico
- Remote — anywhere, Remote — within US/UK/Canada/Australia

Add new regions by extending `REGION_TO_COUNTRIES`.

### Mock data (fallback)

If `JOB_API_ID` or `JOB_API_KEY` are absent, the app automatically uses the built-in mock adapter. You'll see 8 realistic job listings across product, engineering, design, marketing, and operations roles. All features work exactly the same.

### Swapping the adapter

The adapter interface is defined in `server/adapters/jobAdapter.js`. To add a new source:

1. Create `server/adapters/myAdapter.js` implementing `async search({ keywords, regions, page, limit })`
2. Return `{ jobs: [...normalizedJobs], total, page, limit }`
3. Update `jobAdapter.js` to instantiate your adapter when the right env vars are present

---

## AI Engine

All AI runs server-side via `server/services/anthropic.js`. The API key is never exposed to the client.

| Mode | Endpoint | Description |
|------|----------|-------------|
| Fit Score | `POST /api/ai/fit-score/:userJobId` | Honest 0–100 score with category breakdown and recruiter verdict |
| Batch Fit Scores | `POST /api/ai/fit-scores` | Score up to 5 jobs at once (called on dashboard load) |
| Score Improvement Questions | `POST /api/ai/score-questions/:userJobId` | 3–5 targeted questions to surface missing resume context |
| Resume Tailoring | `POST /api/ai/tailor-resume/:userJobId` | Rewritten resume targeting the specific role |
| Cover Letter | `POST /api/ai/cover-letter/:userJobId` | Personalized letter from tailored resume |
| Interview Prep | `POST /api/ai/interview-prep/:userJobId` | Role-specific questions + coaching + watch-outs |
| Post-Interview Debrief | `POST /api/ai/debrief/:userJobId` | Plain-language assessment from interview notes |
| Role Suggestions | `POST /api/ai/suggest-roles` | AI reads resume and suggests relevant target roles |

### Ground truth rule

The AI never invents a skill, metric, title, or outcome absent from the resume. If a role requires something the candidate doesn't have, the AI says so plainly. This is enforced in the system prompt for every mode.

---

## User Flow

```
Landing
  → Sign up / Sign in (email or Google OAuth)
      → Onboarding (3 steps)
          Step 1: Upload resume (PDF/DOCX) or paste text + select situation
          Step 2: Choose default resume style (5 templates)
          Step 3: AI reads resume → suggests roles → user selects roles + regions
      → Dashboard
          Discover tab:   Fresh listings scored by fit, sorted by score then date
          Interested tab: Flagged jobs → launch Optimization Flow
          Submitted tab:  Applied jobs with Journey Tracker
```

### Optimization Flow (from Interested tab)

1. Fit Score Report — scores, breakdown, gaps, recruiter verdict
2. Score Improvement Q&A — 3–5 targeted questions (if coaching needed)
3. Resume Tailoring — rewritten resume, downloadable as .docx
4. Cover Letter — personalized letter, downloadable as .docx
5. Apply — open job posting, download final docs, mark as applied

### Journey Tracker (in Submitted tab)

Status flow: Applied → Phone Screen → First Interview → Subsequent Interviews → Final Round → Offer → Accepted/Declined

Or: Applied → Rejected / Ghosted / Withdrawn

From any active stage: access Interview Prep or Post-Interview Debrief.

---

## Project Structure

```
apply-ready/
├── README.md
├── package.json              Root npm workspace
├── .env.example              Template for all env vars
├── sql/
│   └── schema.sql            Full Supabase schema with RLS policies
├── server/
│   ├── package.json
│   ├── index.js              Express entry point
│   ├── middleware/
│   │   ├── auth.js           JWT verification via Supabase
│   │   └── upload.js         multer config for file uploads
│   ├── adapters/
│   │   ├── jobAdapter.js     Adapter factory (Adzuna or mock)
│   │   ├── adzunaAdapter.js  Adzuna implementation
│   │   └── mockAdapter.js    Mock data fallback
│   ├── services/
│   │   ├── anthropic.js      All 7 Claude AI modes
│   │   ├── resumeParser.js   PDF + DOCX text extraction
│   │   └── documentGenerator.js  .docx generation (5 styles)
│   └── routes/
│       ├── profile.js        User profile CRUD
│       ├── resume.js         Resume upload + parsing
│       ├── jobs.js           Job feed, status, BYO job add
│       ├── ai.js             All AI endpoints
│       └── documents.js      .docx download generation
└── client/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx           Routes (Landing / Auth / Onboarding / Dashboard / Profile)
        ├── index.css         Tailwind + design system base
        ├── lib/
        │   ├── supabase.js   Supabase client
        │   └── api.js        Typed API helpers + auth headers
        ├── context/
        │   └── AuthContext.jsx   Auth state provider
        ├── pages/
        │   ├── Landing.jsx
        │   ├── Auth.jsx
        │   ├── Onboarding.jsx
        │   ├── Dashboard.jsx
        │   └── Profile.jsx
        └── components/
            ├── ui/           Button, Badge, Input, Modal, Spinner, ProgressBar
            ├── onboarding/   Step1Resume, Step2Style, Step3Roles
            └── dashboard/    JobCard, DiscoverTab, InterestedTab, SubmittedTab,
                              FitScoreReport, OptimizationFlow, AddJobModal, JourneyTracker
```

---

## Design System

| Token | Value | Use |
|-------|-------|-----|
| `linen` | `#fffdf5` | Canvas / background |
| `ink` | `#2c2c2c` | Primary text |
| `teal` | `#1e8b8b` | Primary accent, CTA buttons |
| `teal-dark` | `#145f5f` | Hover states |
| `teal-deeper` | `#0d3535` | Headlines, dark section background |
| `copper` | `#c87b33` | Labels, secondary accent |
| `gold` | `#edcf30` | "NEW" badge, highlight |

Fonts: **Montserrat** (headings/labels) + **Lora** (body) from Google Fonts.
