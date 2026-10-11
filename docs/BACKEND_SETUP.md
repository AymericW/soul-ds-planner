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

3. New query again: paste the whole of `supabase/migrations/0002_two_events_and_join.sql`
   and click **Run** (see the next section – on a new project it deletes nothing).

## 2b. Upgrading an existing project: Team A + Team B and the join page (0002)

> **⚠ Destructive:** `0002_two_events_and_join.sql` **deletes every row of the `events`
> table** – the current week *and the whole event history* (lineups, attendance,
> participation statistics). Members (roster, aliases, power), suspensions, settings and
> accounts are kept. This reset was decided because old events have no Team A/B slot.

1. In the app (as R5): **Settings → Export backup** and keep the file.
2. Dashboard → **SQL Editor → New query** → paste the whole of
   `supabase/migrations/0002_two_events_and_join.sql` → **Run**. It runs in one
   transaction (all or nothing). Run it **once**, after 0001.
3. Deploy the new app version (push to `main`). Deploy **after** the migration: the new
   app needs the new tables and functions, and the old app would not understand the new
   events.
4. Open the app once: the Team A and Team B events of the upcoming Friday exist already
   (the migration and the app create them automatically every week – no cron needed).

What 0002 adds:

* `join_requests` and `power_changes` tables – leaders-only row-level security, like the
  other tables. Nothing is readable or writable by anonymous visitors.
* `ensure_week_events()` – creates the missing Team A / Team B events of the upcoming
  Friday (Paris time). Callable by anyone, idempotent, creates only empty events.
* `join_get_roster`, `join_get_submission`, `join_submit`, `join_request_unlisted` –
  the only things the public join page can call. `SECURITY DEFINER` functions with an empty
  `search_path`, executable by `anon` and `authenticated` only, and each one checks the join
  code against the settings first. The roster function returns only id + name of active
  members (never power or activity).
* A `private` schema (not exposed by the API) with helpers and the rate-limit log.
* `finalise_event` now also receives the suspension list it was computed from and refuses
  (conflict) if it changed meanwhile – so finalising Team A and Team B at the same moment
  can never lose a suspension.

Abuse guard / limits (change them in the SQL and in `JOIN_LIMITS`, `src/constants/rules.ts`):

| Limit | Value |
| --- | --- |
| Power accepted | 1M – 5B |
| Submissions per member | 6 per 10 minutes |
| "Not in the list" requests per (normalised) name | 3 per hour, one pending request per name and Friday |
| New "not in the list" requests, all names together | 10 per hour |
| Pending requests in total | 30 (new ones are refused until leaders resolve some) |
| Name length | 2 – 32 characters |

Failed calls (wrong code, closed event…) are not counted. The code itself is the
protection against strangers: 8 characters from 32 symbols (≈10¹² combinations).

## 2c. Join code (public registration link)

The join page is **disabled until a code exists**.

* **Create / rotate:** in the app, **Settings → Player join link → Create a join code**
  (or **New code** to rotate – the old link stops working immediately). **Copy join link**
  copies `https://…/#/join?code=XXXXXXXX` for the alliance chat. **Disable the join page**
  removes the code.
* **From the SQL editor** (e.g. if the app is not deployed yet). A trigger protects the code
  from ordinary settings saves, so the script must switch the guard off for its own transaction:

  ```sql
  begin;
  select set_config('app.join_code_write', 'on', true);
  update public.settings set data = data || '{"joinCode": "ABCD2345"}' where id = 'app';
  commit;
  ```

  Codes are 6–16 capital letters or digits. If the `settings` row does not exist yet,
  save the settings once in the app first.
* **The code only changes through these two ways** (`set_join_code()` from the app, or the
  script above). Saving the other settings, or restoring a backup, never changes it: a page
  that is out of date cannot bring back a code you rotated or disabled. After **Restore
  backup** / **Reset all data** the join page is therefore disabled – create a new code.
* The accepted power drop / rise for self-reported power (default −10% / +30%) are sliders
  in the same Settings card.

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

Players (no account) can only use the public join page through the `join_*` functions:
see the current Team A/B answer of a roster name (choices and time only, never power), register/update themselves while an event is open, report
their power and ask to be added to the roster.

The rules live in the database (`supabase/migrations/0001_init.sql`), not only in the
screens, so they hold even if someone calls the API directly. Restore/reset buttons are
hidden for R4s in the app; the database treats those writes as normal R4 edits, so
treat the R4 role as trusted.

## Changing the schema later

Add a new file `supabase/migrations/0003_….sql` and run it in the SQL Editor. Do not
edit `0001` or `0002`.
