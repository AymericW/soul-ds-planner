# User guide (for R4s / leaders)

The app has five tabs: **This week**, **Roster**, **Requests**, **History**, **Settings**.
Everything is saved automatically and shared by all R4s.

**Two events every Friday:** **Team A** (10 PM Paris time) and **Team B** (1 PM). They are
separate teams with their own poll, lineup and attendance. A player may register for both
to raise their chance to play, but plays in **at most one** of them per week – the app
makes sure of it.

---

## 1. First time: the roster

Open **Roster**.

* **Try it first?** Tap **Load demo roster** (fictional members) and play with the whole
  weekly flow. Later use **Settings → Reset all data** to start clean.
* **Import your roster** with **Import CSV / Excel**. The first sheet / the file needs a
  header row with at least a name column. Recognised headers (any order, any case):

  | Field | Accepted headers (examples) | Values |
  | --- | --- | --- |
  | name (required) | Name, Player, Member, Nickname, IGN | text |
  | power | Power, Total power, Power (M) | `152.3M`, `1.2B`, `152300000`, `152,3` (numbers below 100 000 are read as millions) |
  | activity | Activity, Activity rating, Rating | 1 – 5 |
  | rank (optional) | Rank, Role | R1 – R5 (or 1–5) |
  | active (optional) | Active, Status | yes/no, true/false, 1/0 |

  A **preview** shows what will be added, updated (with the exact changes), left unchanged
  or skipped (with the reason) before anything is saved. Existing members are matched by
  name (case, accents and symbols ignored). Empty cells never erase existing values.
  A ready-made example is in `docs/sample-roster.csv` (also served at `/samples/sample-roster.csv`).
* **Add / edit** a member by tapping **+ Add member** or a member card: name, power,
  **activity rating 1–5** (your judgement as R4), rank, active flag, notes.
  Inactive members stay in the history but are never selected.
* Each card shows: power, activity, **participation** (weeks played ÷ weeks registered,
  Team A and B combined – registering for both and playing one counts as a played week),
  **played** (weeks played/registered), **last played** (in weeks) and any **suspension**.
  Every power change (yours or a player's) is kept in the power history.
* **Export CSV** saves the roster with these statistics.

## 2. Every week

Open **This week**. The Team A and Team B events of the upcoming Friday already exist
(they are created automatically). Use the **Team A / Team B** switcher at the top: each
event has its own 4-step wizard. (Only for an unusual date: when no week is open, pick a
date and tap **Create Team A and Team B**.)

### Players register themselves (join link)

In **Settings → Player join link**, create a join code and **Copy join link**; post it in
the alliance chat. Players open it without an account, pick their name from the roster,
enter their power and choose, per event, **Not available / Play / Sub only**. They appear
in step 1 already ticked with a **Self-registered** badge, the time they sent it and the
power they entered (in orange when their power change waits for your review). You can
still untick them or fix their power (**Power** button). Self-registration stays open
until **Wednesday 10 PM (22h) Paris time**, even after you ran the selection: late sign-ups
show up as "Registrations changed since the selection" – run the selection again (or keep the
plan and add them as substitutes). It closes for good once you lock (publish) the plan. Players who are not in the roster can tap
**I'm not in the list**: their request lands in the **Requests** tab.

### Step 1 – Poll

1. In the game, open the Desert Storm poll and take a screenshot of the list of players
   who voted **Yes** (scroll and take several screenshots if the list is long – import
   them one after another, ticks add up).
2. Tap **Choose screenshot**. The app reads the names on your phone (OCR) and ticks the
   matching members. The screenshot stays visible above the list so you can compare.
3. Check the checklist and fix anything: tick forgotten voters, untick mistakes. Use the
   search box and the *Registered / Not registered* filter.
4. **Not recognised** chips are names the app could not match. Tap one and choose the
   member: the app **remembers this spelling** and will recognise it next time. Tap ✕ for
   lines that are not players.
5. Someone new? **+ New member** adds them to the roster and registers them.
6. Tap **Run selection** (for the event shown). While the other event has no plan yet,
   both are balanced together but only this one is saved. **Run selection for Team A and
   Team B together** recomputes and saves both at once.

> The checklist always works, even without OCR (offline, old phone, bad screenshot).

### Step 2 – Selection

You see four groups, each player with a short **why**:

* **Core** – best relative score (power compared with this week's strongest applicant + activity).
* **Rotation** – players who waited longest since they last played.
* **Substitutes** – numbered in call-in order.
* **Not selected** – over the cap, inactive or suspended (with the reason).

A starter of the other event is never in this lineup (*Not selected – Starter in Team B this
week*); a substitute of the other event can only be a substitute here.

Tap a player to **move** them to another group or **swap** them with someone (moves that
would put a player in both lineups are refused with an explanation). If you
change registrations afterwards, the app offers to keep the plan (late voters become
the last substitutes) or to re-run. Rules are explained in `docs/ALGORITHM.md`.

### Step 3 - Share

**Copy plan text** and paste it in the alliance chat. The poll and the lineup stay
editable until the event: create the week on Monday, tweak starters, rotation and subs
until Friday. Attendance opens on the event date (an "open anyway" link covers
early/late cases).

### Step 4 – Attendance (after the event)

1. Screenshot the participant list of the event (Team A or Team B) and import it: players
   found are marked **Entered**. Fix the ticks by hand if needed. A player who already
   entered the other event this week cannot be marked.
2. Substitutes: tick only those who were **called in and entered**. Unused substitutes
   are not counted as played and keep their priority for next week. Substitutes are never
   penalised.
3. For every **absent starter**, answer **"Told an R4 / arranged a substitute?"**
   *Yes* = no penalty (a late notice counts too). *No* = suspended from Team A and
   Team B for the next 2 weeks (configurable).
4. Check the red summary (who will be suspended) and tap **Finalise event**.
   History, rotation priority and suspensions update automatically. Next week starts
   from there.

## 2b. Requests

The **Requests** tab (with a red counter when something waits) lists:

* **Not in the roster** – players who used *I'm not in the list*. The closest roster names
  are suggested: **This is X** links the request to X (the typed name is remembered as a
  spelling of X, X is registered for the events requested if they are still open, and the
  power rule applies). **Add as new member** creates the member (activity 3) and registers
  them. **Reject** dismisses it.
* **Power changes to review** – powers entered on the join page that differ too much from
  the roster (default: more than 10% lower or 30% higher). **Approve** updates the roster,
  **Reject** keeps the roster value. Smaller changes are applied automatically.

## 3. History

Every event with core / rotation / substitutes, who played, who was absent (notified or
not), who was not selected and the penalties issued. Active suspensions are listed at
the top. To lift one early: Roster → member → **Lift suspension**.

## 4. Settings

* Core starters (14), rotation starters (6), substitutes (10) per event – 30 places each.
* Suspension length in weeks (2; 0 disables penalties).
* **Player join link**: create / rotate / disable the join code, copy the link, and the
  accepted power drop / rise (−10% / +30%) for self-reported power.
* Core score weights: Power % / Activity % (70/30) and the tie margin (0.02).
* **Export backup (JSON)** – do this regularly and before changing phone.
  **Restore backup** and **Reset all data** (type RESET) replace/delete the data of the
  whole alliance and are available to R5 only.

## 5. OCR tips (better screenshots = fewer corrections)

* Take **clean, full-width screenshots** of the list – no popups, keyboard or chat over it.
* Prefer the **largest text** the game offers; zoomed or cropped tiny thumbnails read badly.
* Several short screenshots are better than one blurry long one. Import them one by one.
* Avoid photos of another screen – use the phone's screenshot function.
* The first OCR needs **internet** once (it downloads the free OCR engine, a few MB).
  After that it also works offline.
* Names with exotic symbols or very short names (≤ 4 letters) need a near-exact read;
  fix them once through **Not recognised** and they are remembered.
* Want to see it work first? On step 1 and step 4, tap **Try the sample**.

## 6. Good to know

* Sign in with the account an R5 created for you (see docs/BACKEND_SETUP.md). All R4s
  share the same data and see each other's changes live; the app needs an internet
  connection.
* If two R4s change the same event at the very same moment, the app reloads the latest
  version and asks you to redo your last change.
* Keep backups (Settings → Export backup): the free backend has no automatic backups.
