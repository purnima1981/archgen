# ArchGen — AI Architecture Diagram Generator

Same auth system as [MemoryGarden](https://github.com/purnima1981/MemoryGarden): Express + PostgreSQL + Drizzle + express-session.

## Deploy to Railway

### 1. Create a new project on [railway.app](https://railway.app)

### 2. Add a PostgreSQL database
- Click **"+ New"** → **"Database"** → **"PostgreSQL"**

### 3. Deploy the app
- Connect your GitHub repo OR deploy from CLI
- Railway auto-detects Node.js and runs `npm run build` + `npm run start`

### 4. Set environment variables
In the Railway service settings, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Auto-linked from PostgreSQL service |
| `SESSION_SECRET` | Any random string (e.g., `openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (optional, for diagram gen) |

### 5. Push database schema
```bash
# From Railway CLI or shell:
npx drizzle-kit push
```

Or add to your build command in Railway settings:
```
npm run build && npx drizzle-kit push
```

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Set up .env (copy from .env.example, add your DATABASE_URL)
cp .env.example .env

# 3. Push schema to database
npm run db:push

# 4. Start dev server
npm run dev
```

App runs on http://localhost:5000

## Stack
- **Server**: Express + TypeScript + Drizzle ORM
- **Auth**: Email/password with express-session + connect-pg-simple (same as MemoryGarden)
- **Database**: PostgreSQL
- **Client**: React + Vite + Tailwind CSS
- **Build**: esbuild (server) + Vite (client)

## Auth endpoints (same as MemoryGarden)
- `POST /api/auth/register` — Sign up with email, password, firstName, lastName
- `POST /api/auth/login` — Sign in with email, password
- `GET /api/auth/user` — Get current user (requires session)
- `POST /api/logout` — Sign out
