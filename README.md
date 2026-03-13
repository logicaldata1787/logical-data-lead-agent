# Logical Data Lead Agent

Email-first lead-gen + outreach webapp for [logicaldatasolution.com](https://logicaldatasolution.com).  
Built for Railway deployment with Postgres, Gmail OAuth, and Apollo.io integration.

---

## Features

- **Invite-only team auth** — email/password + JWT sessions; admin creates users
- **Contact management** — CSV import, dedup by email, link to company/event, pipeline stages
- **Event tracking** — create tradeshow/conference events, link contacts to events
- **Sequences** — multi-step email templates with personalization ({{first_name}}, {{company}}, {{event_name}}, etc.)
- **Enrollments** — enroll contacts into sequences; scheduling with per-step delays
- **Email sending** — Gmail API OAuth (preferred) or Gmail SMTP App Password; per-user daily limits
- **Demo Mode** — simulate email sends without any real SMTP/OAuth setup
- **Unsubscribe** — token-based unsubscribe link in every email + suppression list
- **Pipeline** — 6-stage kanban: Prospect → Contacted → Replied → Qualified → Closed → Lost
- **Apollo.io integration** — search people by domain/title, import as contacts
- **Inbox** — view and mark replies; auto-advances pipeline stage

---

## Quick Start (Railway)

### 1. Database

1. In Railway, create a **Postgres** service
2. Copy the `DATABASE_URL` connection string

### 2. Deploy the backend

1. Connect the `logicaldata1787/logical-data-lead-agent` repo to a Railway service
2. Set **Root Directory** = `backend`
3. Set **Start Command** = `npm start`

### 3. Set Railway Environment Variables

Go to your Railway backend service → **Variables** and add:

```env
# Required
DATABASE_URL=postgresql://...    # from Railway Postgres
JWT_SECRET=<random-32+-chars>
NODE_ENV=production
APP_URL=https://your-app.up.railway.app

# Email sending — choose Gmail OAuth (preferred) or SMTP
# Option A: Gmail OAuth
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_REDIRECT_URI=https://your-app.up.railway.app/api/email-accounts/oauth/callback

# Option B: Gmail SMTP (App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=<16-char Gmail App Password>
MAIL_FROM=your@gmail.com

# Apollo.io (sourcing)
APOLLO_API_KEY=<your Apollo API key>

# Demo mode (set to true during testing, false in production)
DEMO_MODE=true
```

### 4. Run database migrations

After deploying, open a Railway shell or use the Prisma CLI locally:

```bash
cd backend
DATABASE_URL=<your-railway-db-url> npx prisma db push
```

Or use `prisma migrate deploy` if you prefer versioned migrations:

```bash
cd backend
npx prisma migrate dev --name init   # generates migration files
DATABASE_URL=<your-url> npx prisma migrate deploy
```

### 5. Create the first admin user

```bash
cd backend
DATABASE_URL=<your-url> node scripts/create-admin.js admin@yourcompany.com StrongPassword123 "Your Name"
```

Or via Railway CLI:
```bash
railway run node scripts/create-admin.js admin@yourcompany.com StrongPassword123 "Admin"
```

### 6. Log in

Open `https://your-app.up.railway.app` → login with the admin credentials above.

---

## Gmail OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable **Gmail API**
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `https://your-app.up.railway.app/api/email-accounts/oauth/callback`
6. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Railway

After login, each team member goes to **Email Accounts → Connect Gmail** and authorizes their mailbox.

---

## Gmail SMTP (App Password) Setup

1. Enable 2-Step Verification on the Google account
2. Go to [Google Account → Security → App Passwords](https://myaccount.google.com/apppasswords)
3. Generate an app password for "Mail"
4. Set `SMTP_USER=your@gmail.com` and `SMTP_PASS=<16-char password>` in Railway

Each team member adds their SMTP account via **Email Accounts → Add SMTP Account** in the UI.

---

## Workflow

1. **Create an event** — Events page → Add Event (e.g., "CES 2026", "SaaStr Annual 2026")
2. **Import contacts** — Contacts page → Import CSV
   - Required columns: `email`
   - Optional: `first_name`, `last_name`, `title`, `company`, `domain`, `linkedin_url`, `source`
3. **Or source via Apollo** — Apollo page → enter company domains + title filters → Search → Import
4. **Create a sequence** — Sequences page → Add Sequence → add steps with subject/body/delay
5. **Enroll contacts** — Enrollments page → Enroll → select contacts + sequence
6. **Monitor** — Dashboard shows stats; Inbox shows replies; Pipeline shows stages
7. **Unsubscribes** — handled automatically; link in every email footer

---

## Personalization Variables

Use these in sequence step subject/body:

| Variable | Value |
|----------|-------|
| `{{first_name}}` | Contact's first name |
| `{{last_name}}` | Contact's last name |
| `{{company}}` | Contact's company name |
| `{{title}}` | Contact's job title |
| `{{event_name}}` | Event name (if enrolled from an event) |

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/users` | List / invite users (admin) |
| GET/POST | `/api/contacts` | List / create contacts |
| POST | `/api/contacts/import` | CSV upload |
| PATCH | `/api/contacts/:id/stage` | Update pipeline stage |
| GET/POST/PUT/DELETE | `/api/events` | Events CRUD |
| GET/POST/PUT/DELETE | `/api/sequences` | Sequences + steps CRUD |
| GET/POST | `/api/enrollments` | List / create enrollments |
| GET/POST | `/api/email-accounts` | Manage email accounts |
| GET | `/api/email-accounts/oauth/url` | Gmail OAuth URL |
| GET | `/api/email-accounts/oauth/callback` | Gmail OAuth callback |
| GET | `/api/inbox` | View replies |
| PATCH | `/api/inbox/:id/replied` | Mark as replied |
| GET | `/api/analytics` | Dashboard stats |
| POST | `/api/apollo/search` | Apollo people search |
| POST | `/api/apollo/import` | Import Apollo results |
| GET | `/unsubscribe?token=...` | Unsubscribe (public) |

---

## Demo Mode

When `DEMO_MODE=true`:
- All email sends are **simulated** (logged to console, not sent)
- No SMTP/OAuth credentials required
- A yellow banner appears in the UI

Remove `DEMO_MODE` (or set to `false`) before going live.

---

## Local Development

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET at minimum
npm install
npx prisma db push   # create tables
node scripts/create-admin.js admin@test.com password123 Admin
npm run dev          # starts on port 3000
```

Open `http://localhost:3000` in your browser.
