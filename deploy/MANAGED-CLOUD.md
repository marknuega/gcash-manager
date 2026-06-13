# GCash Manager — go live on managed cloud (Neon + Render)

Goal: the app reachable from **any device, anywhere, 24/7** — view and update
from your phone outside your LAN. Data is saved in a real database and stays in
sync across all outlets and cashiers. (Same setup as your ShopOps app.)

```
  Phone / outlet PC / your laptop
            │  https
            ▼
   Render web service  ──►  serves the app  + the API     (free, 24/7)
            │  TLS
            ▼
   Neon PostgreSQL  ──►  your single source of truth        (free, 24/7)
```

You do this **once**. ~20 minutes. Two free accounts, no credit card.

---

## 1. Create the database (Neon)

1. Go to **https://neon.tech** → sign up (GitHub/Google is fastest).
2. **Create a project** → name it `gcash`, region **Asia Pacific (Singapore)**.
3. On the dashboard, click **Connect** → copy the **connection string**. It looks like:
   ```
   postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/gcash?sslmode=require
   ```
   Keep `?sslmode=require` at the end. **Save this — it's your `DATABASE_URL`.**

## 2. Create the tables + first logins (run once, from your PC)

```bash
cd "C:/Users/DELL/Downloads/gcash-manager-app/server"
cp .env.example .env          # then edit server/.env:
#   DATABASE_URL = the Neon string from step 1
#   JWT_SECRET   = any long random text
#   SEED_ADMIN_PASSWORD = the owner password you want
npm install
npm run db:setup              # creates all tables in Neon
npm run db:seed               # creates logins + demo outlets/customers
```

`db:seed` prints the logins it creates. By default:

| Login    | Role    | Can do                                  |
|----------|---------|-----------------------------------------|
| `admin`  | Owner   | Everything, all outlets                 |
| `maria`  | Cashier | Their outlet (Divisoria)                |
| `juan`   | Cashier | Their outlet (Cubao)                    |
| `ana`    | Cashier | Their outlet (Caloocan)                 |
| `pedro`  | Cashier | Their outlet (Pasay)                    |

Change every password from the **Accounts** tab once you're in.

## 3. Put the code on GitHub (Render deploys from GitHub)

```bash
cd "C:/Users/DELL/Downloads/gcash-manager-app"
git init
git add -A
git commit -m "GCash Manager — initial deploy"
# create an EMPTY repo named gcash-manager at https://github.com/new , then:
git branch -M main
git remote add origin https://github.com/<your-username>/gcash-manager.git
git push -u origin main
```

> `server/.env` is git-ignored, so your password/secret never leave your PC.

## 4. Deploy the app (Render)

1. Go to **https://render.com** → sign up → connect your GitHub.
2. **New** → **Blueprint** → pick the `gcash-manager` repo. Render reads `render.yaml`.
3. When prompted, set **`DATABASE_URL`** = the same Neon string from step 1.
   (`JWT_SECRET` is generated automatically.)
4. **Apply / Create** → wait for the build (~3–5 min). Render gives you a URL like
   `https://gcash-manager.onrender.com`.

## 5. Done — open it on your phone

Open the Render URL on any device, log in as `admin`. Everyone you add under
**Accounts** can log in from their own phone/PC, anywhere, and sees the same
live data. The app auto-refreshes every ~20s and whenever a tab regains focus.

---

## Notes & gotchas
- **Free Render sleeps** after ~15 min idle; the next visit takes ~50s to wake,
  then it's fast again. To stay always-on, upgrade that service's plan.
- **Re-deploy** after code changes: `git push` → Render rebuilds automatically.
- **Schema change?** Re-run `npm run db:setup` from your PC (it's idempotent).
- **JWT_SECRET must stay constant** — if it changes, everyone is logged out.
- Same `DATABASE_URL` goes in BOTH places (your local `server/.env` for
  setup/seed, and Render for the running app).
- **Offline / demo mode:** `npm run dev` still runs the app with no server,
  using localStorage — handy for trying things out. The live build
  (`VITE_MOCK=false`, set in `.env.production`) is what talks to the database.
```
