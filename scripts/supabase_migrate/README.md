# Supabase region migration — Mumbai → Frankfurt

Scripts + playbook for moving the project's Postgres + Auth data off
`ap-south-1` onto `eu-central-1`, co-located with the Render backend.

## What this does

- `01_dump.sh` — exports `public` schema (your app tables) + `auth` user
  rows (preserves passwords / OAuth identities so nobody has to reset)
  + sequence setvals. Writes to `./dumps/`.
- `02_restore.sh` — loads those dumps into a fresh Supabase project in
  the target region.
- `03_verify.sh` — row-count diff between old + new. Exit code 0 if
  everything matches.

## Prereqs

```bash
# Postgres client tools (pg_dump / psql)
brew install libpq
brew link --force libpq

# Supabase CLI (optional, only for the auth export path — see step 3)
brew install supabase/tap/supabase
```

## One-time: create the new project

1. Dashboard → **New Project** → Region: `Europe Central (Frankfurt)`.
2. Use the **same DB password** as the old project if you want the
   connection strings to be structurally identical.
3. Wait ~2 min for the project to come up. Don't touch it yet.

## Get your connection strings

For each project: **Dashboard → Settings → Database → Connection string → URI**.

**Critical:** use the **session pooler (port 5432)**, not the transaction
pooler (6543). `pg_dump` needs real sessions. The URL shape is:

```
postgresql://postgres.<REF>:<PW>@aws-0-<REGION>.pooler.supabase.com:5432/postgres
```

For the app's runtime (Render `DATABASE_URL`) you still want the
**transaction pooler (6543)**. Different purpose.

## Run the migration

```bash
cd scripts/supabase_migrate

export OLD_DB="postgresql://postgres.<OLD_REF>:<OLD_PW>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
export NEW_DB="postgresql://postgres.<NEW_REF>:<NEW_PW>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

./01_dump.sh      # ~30s, writes ./dumps/
./02_restore.sh   # 1–5 min depending on data size
./03_verify.sh    # row-count diff
```

If `03_verify.sh` prints any `DIFF` lines, don't switch env vars yet.

## Update env vars (after verify passes)

Three places to update. Keep the OLD values around in case you need to
roll back.

### Render (backend)

Dashboard → your service → **Environment** → edit:

```
DATABASE_URL=postgresql://postgres.<NEW_REF>:<NEW_PW>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
```

Save → **Manual Deploy** to pick it up.

### Vercel (frontend)

Dashboard → **Project Settings → Environment Variables** → update for
Production (and Preview if you use it):

```
NEXT_PUBLIC_SUPABASE_URL=https://<NEW_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<NEW anon key from new project's Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<NEW service_role key>   # if you have this set
```

Trigger a **Redeploy** (Deployments → latest → Redeploy).

### Local `.env.local`

Same three values as Vercel, plus `frontend/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<NEW_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<NEW anon key>
```

…and your root `.env`:

```
DATABASE_URL=postgresql://postgres.<NEW_REF>:<NEW_PW>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
```

## Smoke-test

With the new env live:

- [ ] Sign in with an **existing** user account → should work with the
      old password (auth.users was migrated with `encrypted_password`).
- [ ] Load `/counties` → the ranking table populates.
- [ ] Load `/transparency` → waterfall renders.
- [ ] Watchlist / alerts (any write endpoint) → persists correctly.
- [ ] Sign up a new user → confirms the new project's auth is wired.

## Rollback (if something breaks)

Two minutes to flip back:

1. Revert the three env-var files/dashboards to the OLD values.
2. Redeploy Render + Vercel.
3. Old project is still live, no data lost. Figure out what went wrong
   against the new project without users on it.

## When to delete the old project

Leave the old (Mumbai) project running for **at least a week**. It costs
nothing on Free tier. After a week of the new project being stable, go
to Dashboard → old project → Settings → General → **Delete project**.

## Gotchas

- **RLS policies** are included in the `public` dump. Spot-check a few
  in the new project's SQL editor after restore.
- **Alembic migrations**: don't re-run them against the new project —
  the dump already includes the fully-migrated schema. If you do run
  `alembic upgrade head` anyway, it'll be a no-op because
  `alembic_version` table came across too.
- **Custom policies / functions in the `auth` schema**: this script
  doesn't migrate those. If you've written triggers against `auth.users`
  (rare), dump them separately with
  `pg_dump "$OLD_DB" --schema=auth --schema-only --no-owner`.
- **Sessions invalidate**: all logged-in users get kicked out (their
  JWTs were signed by the OLD project's key). One-time re-login — not
  a password reset.
- **Region in connection strings differs** between session pooler and
  transaction pooler. Session pooler uses `aws-0-eu-central-1`,
  transaction pooler uses the same prefix but port 6543.

## File layout after running

```
scripts/supabase_migrate/
├── 01_dump.sh
├── 02_restore.sh
├── 03_verify.sh
├── README.md
└── dumps/              # git-ignored — local only
    ├── public.sql
    ├── auth.sql
    └── sequences.sql
```
