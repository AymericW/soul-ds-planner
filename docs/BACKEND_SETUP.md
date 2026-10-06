# Backend setup (Supabase, free tier)

The app stores everything in a [Supabase](https://supabase.com) project: a Postgres
database, logins, and live updates. The free plan is enough for an alliance
(500 MB database, 50,000 monthly users; the app uses a few KB per event).

> **Free-tier caveat:** projects with no activity for 7 days are *paused* (one click
> to resume, data is kept). Weekly use keeps it awake.

**Before switching from the old offline version:** open the old app, go to
Settings → *Export backup*. You will restore it into the new backend in step 6.

## 1. Create the project

1. Sign up at supabase.com and click **New project** (pick a region near your members).
2. Save the database password somewhere safe (the app does not need it).

## 2. Create the tables and rules

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the whole of `supabase/migrations/0001_init.sql` and click **Run**.

This creates the data tables, the roles (`pending`, `r4`, `r5`, `disabled`),
row-level security (only approved R4/R5 can read or write), version-checked saving
(two R4s can never silently overwrite each other) and live updates.

## 3. Lock down sign-up

Dashboard → **Authentication → Sign In / Providers → Email**:

* turn **off** "Allow new users to sign up" (accounts are invite-only);
* turn **off** "Confirm email" (you create the accounts yourself).

## 4. Create the first account (you, the R5)

Dashboard → **Authentication → Users → Add user → Create new user**: enter your email
and a password, tick *Auto Confirm User*. **The first account ever created becomes R5
automatically.** Everyone created after that starts as `pending`.

## 5. Connect the app

Dashboard → **Project Settings → API**: copy the *Project URL* and the *anon public* key.
They are public by design; the database rules protect the data.

Local development:

```bash
cp .env.example .env.local   # then fill in the two values
npm run dev
```

GitHub Pages deployment: repository **Settings → Secrets and variables → Actions →
Variables** (not Secrets), add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then
push to `main`.

Never put the `service_role` key anywhere in this project.

## 6. Day to day

* **Add an R4:** Dashboard → Authentication → Users → Add user (email + temporary
  password, auto confirm). Send them the password; they sign in and change it in
  Settings → My account. Then open Settings → Accounts in the app and set their role
  to **R4**. Until then they see "Waiting for approval".
* **Forgot password:** an R5 resets it in the dashboard (Users → the user → Send/Update password).
* **Remove access:** set the role to **Disabled** in the app (or delete the user in the dashboard).
* **Restore the old data:** as R5, Settings → *Restore backup…* and pick the file exported in step 0.
* **Backups:** Settings → *Export backup* is a full copy. Supabase's free plan has no
  automatic backups, so export regularly.

## What the roles can do

| | pending / disabled | R4 | R5 |
|---|---|---|---|
| See alliance data | no | yes | yes |
| Plan events, edit roster/lineup, record attendance, finalise | no | yes | yes |
| Change settings | no | yes | yes |
| Manage accounts, restore backup, reset data | no | no | yes |

The rules live in the database (`supabase/migrations/0001_init.sql`), not only in the
screens, so they hold even if someone calls the API directly. Restore/reset buttons are
hidden for R4s in the app; the database treats those writes as normal R4 edits, so
treat the R4 role as trusted.

## Changing the schema later

Add a new file `supabase/migrations/0002_….sql` and run it in the SQL Editor. Do not
edit `0001`.
