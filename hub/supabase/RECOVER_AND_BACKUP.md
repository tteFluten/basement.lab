# Recover data from Supabase and backup Neon

## What happened

When we switched to Neon, we created **empty tables** in Neon and pointed the app to `DATABASE_URL`. The **users and projects** that existed in **Supabase were never migrated** — they are still in the old Supabase database. The app no longer reads from Supabase, so the project editor and user list appear empty.

---

## 1. Recover users and projects from Supabase

You need **read access** to the old Supabase project (dashboard or connection string).

### Option A: Supabase Dashboard (no CLI)

1. Open your **Supabase** project → **Table Editor**.
2. For each table you care about (**users**, **projects**, **project_members**):
   - Open the table.
   - Use the table menu (e.g. "Export" or download) if available to export as CSV.
3. In **Neon** → **SQL Editor** you can’t bulk-import CSV easily; the practical way is Option B.

### Option B: Export with pg_dump, then import into Neon (recommended)

You need the **Supabase database connection string** (URI):

- Supabase Dashboard → **Project Settings** → **Database** → **Connection string** (URI).
- Use the **direct** connection string (not pooler), e.g.  
  `postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres`

On your machine (PowerShell), export **only data** for the tables you need, in an order that respects foreign keys:

```powershell
# Set your Supabase connection string (replace with your real URI)
$env:SUPABASE_URI = "postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-xx.pooler.supabase.com:5432/postgres"

# Export data only (no schema) for users, projects, project_members
# Order matters: users first, then projects, then project_members
pg_dump "$env:SUPABASE_URI" --data-only --column-inserts `
  -t users -t projects -t project_members `
  -f supabase_data.sql
```

If you don’t have `pg_dump` installed, install **PostgreSQL** (e.g. from https://www.postgresql.org/download/windows/) so the `bin` folder (with `pg_dump.exe`) is on your PATH.

Open `supabase_data.sql`: it should contain many `INSERT INTO public.users ...`, `INSERT INTO public.projects ...`, etc.

**Import into Neon:**

1. Neon Dashboard → **SQL Editor**.
2. If Neon uses schema `public` (default), you can keep `public.` in the INSERTs or remove it — both work.
3. **If Neon already has rows** (e.g. from seed): either run once on Neon:
   - `TRUNCATE project_members, projects, users CASCADE;`
   then paste and run the contents of `supabase_data.sql`.
4. Or paste the INSERTs in order (users → projects → project_members). If you get “duplicate key” errors, you’re re-inserting existing data; truncate those tables first as above.

That restores **users**, **projects**, and **project_members** from Supabase into Neon.

---

## 2. Backup Neon from now on

Neon has built-in backups:

1. In Neon Dashboard, select your project and branch (**main**).
2. Go to **Backup & Restore** (in the left menu under the branch).
3. Use the options there to create/restore backups (Neon’s docs describe the exact flow).

For an extra safety copy you can also run a **manual export** from your machine from time to time:

```powershell
# Set your Neon connection string
$env:DATABASE_URL = "postgresql://neondb_owner:xxx@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Full dump (schema + data) — good for disaster recovery
pg_dump "$env:DATABASE_URL" -f neon_backup_$(Get-Date -Format 'yyyyMMdd').sql
```

Store that `.sql` file somewhere safe (e.g. backup drive or private repo). To restore later you’d create a fresh Neon DB (or branch) and run:

```powershell
psql "$env:DATABASE_URL" -f neon_backup_20250309.sql
```

---

## Summary

| Goal | Action |
|------|--------|
| Get back users/projects | Export from Supabase with pg_dump (Option B), then run the generated INSERTs in Neon SQL Editor (truncate first if Neon already has data). |
| Backup Neon from now on | Use Neon **Backup & Restore** in the dashboard and/or run `pg_dump` periodically and save the `.sql` file. |

If you don’t have the Supabase connection string or dashboard access anymore, the old data can’t be recovered unless someone from your team with access exports it for you.
