# 🐬 BotDolphin Admin Dashboard

Admin panel for BotDolphin SaaS — monitor signups, export emails, track plans, view usage, and run SQL queries.

## Features

- **Dashboard** — Total users, signups (7d/30d), chatbots, messages, leads, conversations
- **Charts** — Daily signups, monthly signups, plan distribution (doughnut)
- **User Management** — Browse users, search, sort, paginate
- **CSV Export** — Export any table to CSV (emails, users, leads, etc.)
- **Table Browser** — Browse any database table with search/sort/pagination
- **SQL Console** — Run read-only SELECT queries directly
- **Auto-Discovery** — Automatically detects your database schema and adapts
- **Auth** — Password-protected admin access

## Deploy to Railway (Same Project)

### Step 1: Push to GitHub

```bash
# Create a new GitHub repo (e.g., botdolphin-admin)
cd botdolphin-admin
git init
git add .
git commit -m "BotDolphin Admin Dashboard"
git remote add origin https://github.com/YOUR_USERNAME/botdolphin-admin.git
git branch -M main
git push -u origin main
```

### Step 2: Add to Railway Project

1. Open your Railway project: `diligent-eagerness` (the one with Postgres + 30 + 30-frontend)
2. Click **+ Add** (top right)
3. Select **GitHub Repo**
4. Choose `botdolphin-admin` repo
5. Railway will auto-detect the Dockerfile and start building

### Step 3: Connect to Existing Postgres

1. Click on the new **botdolphin-admin** service in Railway
2. Go to **Variables** tab
3. Click **Add Variable Reference**
4. Select your **Postgres** service → `DATABASE_URL`
   - This auto-links your existing database
5. Add one more variable manually:
   ```
   ADMIN_PASSWORD = your-secure-admin-password
   ```

### Step 4: Generate Domain

1. In the **botdolphin-admin** service, go to **Settings** → **Networking**
2. Click **Generate Domain**
3. You'll get something like: `botdolphin-admin-production.up.railway.app`
4. (Optional) Add custom domain: `admin.botdolphin.com`

### Step 5: Visit Dashboard

Open `https://botdolphin-admin-production.up.railway.app` and login with your `ADMIN_PASSWORD`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (reference from Postgres service) |
| `ADMIN_PASSWORD` | Yes | Password to login to admin dashboard |
| `PORT` | No | Auto-set by Railway (default: 3000) |

## Local Development

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL and ADMIN_PASSWORD
npm install
npm start
# Open http://localhost:3000
```

## Custom Domain Setup (Optional)

To use `admin.botdolphin.com`:

1. In Railway → Service Settings → Networking → Custom Domain
2. Add `admin.botdolphin.com`
3. In your DNS provider (Cloudflare/Netlify DNS), add:
   - CNAME record: `admin` → `botdolphin-admin-production.up.railway.app`

## Security Notes

- Only SELECT queries are allowed in SQL Console
- Auth uses HTTP-only cookies (7-day expiry)
- Change your ADMIN_PASSWORD to something strong
- Consider adding IP restrictions for production
