# Krimson — Backend API

The server powering Krimson's System-first architecture.

Built with: **Node.js + Express + MongoDB + Gemini AI**

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to get it |
|---|---|
| `MONGODB_URI` | [MongoDB Atlas](https://cloud.mongodb.com) → free M0 cluster → Connect → Drivers |
| `JWT_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) → free, no credit card |

### 3. Run in development

```bash
npm run dev
```

Server starts on `http://localhost:8000`

### 4. Health check

```
GET http://localhost:8000/health
```

---

## API Reference

### Auth

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | ✗ | Create account |
| POST | `/api/auth/login` | ✗ | Login |
| GET | `/api/auth/me` | ✓ | Current user |

### Systems

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/systems` | ✓ | Create System |
| GET | `/api/systems` | ✓ | My Systems |
| GET | `/api/systems/:slug` | optional | Get System + pages + theme |
| PUT | `/api/systems/:slug` | ✓ | Update System |
| DELETE | `/api/systems/:slug` | ✓ | Delete System |
| POST | `/api/systems/:slug/publish` | ✓ | Publish System |
| POST | `/api/systems/:slug/fork` | ✓ | Fork System |
| GET | `/api/systems/:slug/activity` | optional | Activity feed |

### Pages

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/systems/:slug/pages` | ✓ | Add Page |
| GET | `/api/systems/:slug/pages` | ✓ | List Pages |
| PUT | `/api/systems/:slug/pages/:pageSlug` | ✓ | Update Page |
| PUT | `/api/systems/:slug/pages/reorder` | ✓ | Reorder Pages |
| DELETE | `/api/systems/:slug/pages/:pageSlug` | ✓ | Delete Page |

### Theme

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/systems/:slug/theme` | optional | Get Theme |
| PUT | `/api/systems/:slug/theme` | ✓ | Update Theme |

### Versions

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/systems/:slug/versions` | ✓ | Create Version (snapshot) |
| GET | `/api/systems/:slug/versions` | optional | List Versions |
| GET | `/api/systems/:slug/versions/:id` | optional | Get Version |
| POST | `/api/systems/:slug/versions/:id/restore` | ✓ | Restore Version |

### Explore

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/explore` | ✗ | Browse public Systems |
| GET | `/api/explore/featured` | ✗ | Featured Systems |
| GET | `/api/explore/categories` | ✗ | Categories + counts |

### AI Assistant

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/ai/suggest-system` | ✓ | Suggest System from prompt |
| POST | `/api/ai/suggest-pages` | ✓ | Suggest additional pages |
| POST | `/api/ai/suggest-theme` | ✓ | Suggest theme tokens |

---

## Deployment — Free Options

### Option A: Railway (recommended)

1. Push backend to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub repo
4. Add environment variables in Railway dashboard
5. Done — Railway auto-deploys on every push

### Option B: Render

1. Push backend to GitHub
2. Go to [render.com](https://render.com)
3. New → Web Service → Connect repo
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables
7. Note: free tier sleeps after 15 min inactivity (wakes in ~30s)

---

## Architecture Notes

**Why MongoDB over PostgreSQL?**
System, Page, Theme, and Version data is document-shaped. MongoDB's flexible schema supports
the `snapshot` field in Version (which stores a complete frozen copy of pages + theme tokens)
without complex joins. For v1.0 this is the right tradeoff.

**Why Gemini over OpenAI/Groq?**
Gemini 1.5 Flash is free up to 1,500 requests/day with no credit card required.
For v1.0 usage levels this is more than sufficient.

**Why JWT over sessions?**
Stateless auth works cleanly across separate frontend/backend deployments on free tiers.
No session store needed.

---

## Domain Model

```
User
└── Workspace
    └── Systems
        ├── Pages
        ├── Theme
        ├── Versions (snapshots)
        └── Activity
```

The System is the primary artifact.
Everything else serves the System.