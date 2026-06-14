# Backups & Restore — GCash Manager

All live data lives in the **Neon Postgres database** (not on the Render
server). Deploys, restarts, and code changes never touch it. These scripts are
your safety net against the one thing a database can't protect you from on its
own: an accidental delete or a bad change.

## Prerequisites
- Node 18+ installed.
- `server/.env` contains your live `DATABASE_URL` (the Neon connection string).
  It's the same value set in the Render dashboard. Never commit this file.

```
cd server
npm install      # once, to get the pg driver
```

## Take a backup
```
cd server
npm run backup
```
Writes a timestamped snapshot to `server/backups/backup-<timestamp>.json`
containing every table (outlets, users, customers, transactions, floats,
presets). The `backups/` folder is git-ignored.

**Important:** copy the file somewhere off this machine (Google Drive, email it
to yourself, a USB stick). A backup that only lives on the same laptop isn't a
real backup.

### How often
- Daily is plenty for a back-office app. Do one before any risky change
  (deleting a branch, editing many records).

## Restore (disaster recovery)
```
cd server
npm run restore -- backups/backup-2026-06-14T21-47-24.json
```
This is **safe — it only adds missing rows and never overwrites or deletes**
existing data (`INSERT ... ON CONFLICT DO NOTHING`). So:
- After a total loss (empty tables) it brings everything back.
- After a partial loss it re-inserts only the rows that are gone.

If you ever need a true point-in-time rewind of the whole database, use Neon's
own **Restore / branching** feature in the Neon dashboard (its retention window
depends on your Neon plan — verify it covers at least a day or two).

## Automatic daily backup (already set up)
A GitHub Actions workflow runs the backup every day in the cloud — no laptop
needed: [.github/workflows/db-backup.yml](../.github/workflows/db-backup.yml).
It runs at **02:00 Manila time** daily and uploads each snapshot as an artifact
kept for 90 days.

**One-time setup (required for it to run):**
1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
2. Name `DATABASE_URL`, value = your Neon connection string (same as Render).

**To run it now / download a backup:**
- Repo → **Actions** tab → *Database Backup* → **Run workflow** (manual trigger).
- Open the finished run → **Artifacts** → download the `.json`.

**Alternative (laptop-based):** Windows Task Scheduler running
`npm --prefix "C:\path\to\server" run backup`, with `server/backups` synced to a
cloud folder. Only runs while the PC is on, so the GitHub Action above is
preferred.
