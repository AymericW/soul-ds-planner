# Selection and penalty rules

Everything on this page is implemented as small, pure functions in `src/domain/`
(no screen, no storage) and covered by unit tests in `tests/domain/`.
Given the same roster, history and settings, the result is always the same.

| Rule | Code | Tests |
| --- | --- | --- |
| Two events per week (Team A / Team B) | `domain/events/weekEvents.ts` | `tests/domain/eventLifecycle.test.ts` |
| Relative score | `domain/scoring/relativeScore.ts` | `tests/domain/scoring.test.ts` |
| Close scores → activity wins | `domain/scoring/coreRanking.ts` | `tests/domain/scoring.test.ts` |
| Eligibility | `domain/selection/eligibility.ts` | `tests/domain/selection.test.ts` |
| Core / rotation / substitutes (one event) | `domain/selection/{core,rotation,substitutes,runSelection}.ts` | `tests/domain/selection.test.ts` |
| One player, one game per week (A vs B) | `domain/selection/{weekSelection,weekConflicts}.ts` | `tests/domain/weekSelection.test.ts` |
| Manual overrides | `domain/selection/overrides.ts` | `tests/domain/overrides.test.ts` |
| Played / participation (in weeks) | `domain/history/*.ts` | `tests/domain/history.test.ts` |
| No-show penalty, weekly countdown | `domain/penalties/*.ts` | `tests/domain/penalties.test.ts` |
| Join page: registration mapping, power rule | `domain/join/*.ts`, `domain/roster/powerChanges.ts` | `tests/domain/join.test.ts`, `tests/data/inMemoryRepositories.test.ts` |

## 0. Two events every Friday

Every Friday (Paris time) has **two independent events**: **Team A** at 10 PM and
**Team B** at 1 PM. Each has its own registrations, lineup, attendance and finalisation
(`WeekEvent.slot = 'A' | 'B'`, id `YYYY-MM-DD-A` / `YYYY-MM-DD-B`).

* Both events of the **upcoming Friday** are created automatically – today if today is a
  Friday (Paris time, until midnight), otherwise the next Friday. No cron: the leaders'
  app and the public join page call `ensure_week_events()` (idempotent).
* A player may **register for both** (more chances to be picked) but can **play in only
  one** of them per week (section 6).
* Both events use the same settings (core / rotation / substitutes per event).

## 1. Settings (all configurable in the app)

| Setting | Default | Meaning |
| --- | --- | --- |
| Core starters | 14 | Best relative scores (per event) |
| Rotation starters | 6 | Fair turn for those who waited longest (per event) |
| Substitutes | 10 | Called in, in order, when a starter is missing (per event) |
| Suspension length | 2 | **Weeks** a no-show is excluded for (Team A and Team B) |
| Weights | 70% power / 30% activity | Used for the core score |
| Tie margin (ε) | 0.02 | Scores this close are "too close to call" |
| Accepted power drop / rise | −10% / +30% | Self-reported power in this range updates the roster directly (section 10) |
| Join code | (none) | Secret of the public join link; empty = join page disabled |

**Starters** = core + rotation (default 20).
**Places per event** = starters + substitutes (default 30).

## 2. Who can be selected (eligibility)

Only members who registered (ticked in step 1, or self-registered) **and** are

* marked **active**, and
* **not currently suspended**, and
* **not already committed in the other event of the week** (section 6).

Ineligible applicants are listed under *Not selected* with the reason
("Inactive member", "Suspended – 2 weeks left", "Starter in Team B this week").

## 3. Core: relative score

The core is **not** "the 14 strongest". Each eligible applicant gets a score
between 0 and 1, computed against **this event's pool of eligible applicants**:

```
powerRatio  = power / (highest power among this event's eligible applicants)
activity01  = (activity − 1) / 4            # 1→0, 3→0.5, 5→1
score       = wPower × powerRatio + wActivity × activity01
```

Weights are rescaled to add up to 1 (70/30 = 0.7/0.3).

**Why "ratio to the strongest" and not a percentile?** A ratio keeps real gaps:
240M vs 230M are almost equal (0.96), while 240M vs 120M is clearly half (0.5).
A percentile would turn tiny power differences into big rank jumps. It also stays
easy to explain: "you have 82% of the top power". It is relative: the same
player scores higher in a week where the giants did not register.

The core takes the best `coreStarters` scores. Exact ties are broken by
activity, then power, then name (alphabetical) so the result is deterministic.

### Worked example (defaults 70/30)

| Player | Power | Activity | powerRatio | activity01 | Score |
| --- | --- | --- | --- | --- | --- |
| A | 200M | 2 | 1.00 | 0.25 | 0.7×1.00 + 0.3×0.25 = **0.775** |
| B | 190M | 4 | 0.95 | 0.75 | 0.665 + 0.225 = **0.890** |
| C | 150M | 5 | 0.75 | 1.00 | 0.525 + 0.300 = **0.825** |
| D | 100M | 3 | 0.50 | 0.50 | 0.350 + 0.150 = **0.500** |

Ranking: B, C, A, D. With 2 core places, B and C are core even though A is the
strongest – A is barely active.

### Close scores: higher activity wins

After sorting by score, the list is scanned top to bottom: when a player's score
is within ε (default 0.02) of the player **directly above** and they have a
**higher activity**, they swap places. This repeats until nothing changes
(it always ends: every swap moves a more active player up).

Example: E = 0.800 (activity 3), F = 0.785 (activity 5). The gap is 0.015 ≤ 0.02,
so **F ranks above E**. With G = 0.770 (activity 5) right below E, the gap
E–G is 0.03 > 0.02, so G stays below E.

Because swaps are between neighbours, a very active player can climb past
several close players in a row ("chain"): each single step is within ε.

## 4. Rotation priority (history counted in weeks)

History is counted in **weeks**: Team A and Team B of one Friday form **one week**.
Only finalised events of weeks **before** the week being planned count (a Team B already
finalised on the same Friday never changes Team A's rotation).

Rotation places go to eligible applicants **not in the core**, ordered by:

1. **Did not play last week** (in Team A or Team B) comes first.
2. **Longest time since last played**, in weeks (*never played* counts as the longest).
   A week in which the player played in A **or** B is one played week – playing both
   (which the app prevents) would still count once.
3. Tie-break: **higher activity**, then **higher power**, then name.

The first `rotationStarters` become rotation starters.

### Worked example

Finalised weeks (oldest → newest): W1, W2, W3.

| Player | Last played | Played last week (W3)? | Priority |
| --- | --- | --- | --- |
| P | never | no | 1st |
| Q | W1, Team B (2 weeks ago) | no | 2nd (tie with R: same activity, more power) |
| R | W1, Team A (2 weeks ago) | no | 3rd |
| S | W2 (1 week ago) | no | 4th |
| T | W3 | **yes** | last |

With 2 rotation places: P and Q are rotation starters; R, S, T go on to the substitutes.

## 5. Substitutes and the places

After the rotation, starter applicants who missed a starter place take the substitute
places first (by the **same rotation priority**); substitute-only volunteers get what is
left. Their order is the call-in order.

* **Fewer eligible applicants than places**: nobody is cut. Starters are filled first
  (core, then rotation) and everyone else is a substitute. Example: 25 applicants with
  14/6/10 → 14 core, 6 rotation, 5 substitutes, 0 not selected. 5 applicants → 5 core.
* **More applicants than places**: whoever is left after the substitutes is *Not selected*
  ("No place left (30 places) – lower rotation priority"). Because they did not play,
  their rotation priority rises for next week.

## 6. One player, one game per week (Team A vs Team B)

Rules between the two events of a week (`domain/selection/weekConflicts.ts`):

| In the other event the player is… | …here they can be |
| --- | --- |
| a **starter** (core / rotation) | nothing (*Not selected – Starter in Team B this week*) |
| a **substitute** (not used) | substitute only (never starter) |
| someone who **entered** (starter or called-in substitute) | nothing (*Already played in Team B this week*) |
| not listed | anything |

So a player may be **listed as substitute in both** events; as soon as they actually
enter one of them, they are out of the other (attendance for them is refused there).

### Week-level selection (`selectWeek`)

The selection of a week takes both events' registrations, the shared history and the
"fixed" event, and resolves conflicts deterministically:

1. **Fixed event respected.** When only one event is (re)computed and the other already
   has a plan (planned, locked or finalised), the other plan is kept and the rules above
   apply to it. Re-running Team A therefore never steals a Team B starter.
2. **Scarcer event first.** When both events are computed together, each gets a
   *scarcity* = eligible starter applicants ÷ starter places (substitute-only
   registrations, inactive/suspended players and players blocked by a fixed event do not
   count). The **lower** ratio is resolved first (tie → **Team A**). It keeps its starters;
   the other event is then selected without them, and the first event's substitutes may
   only be substitutes there.
3. **Contested players go where they fill a board.** If a player who is only a
   *substitute* in the first event becomes a *starter* in the second, they are removed from
   the first event and the first event is recomputed (its next substitute moves up). This
   repeats until stable; it always ends because the set of removed players only grows.

Result invariants (unit-tested): nobody is a starter in both events, a starter of one
event is never listed in the other, substitutes may appear in both.

**When are both events computed together?**

* *Run selection* on one event: the other event is included **only while it has no plan
  yet** (status *registration*) so the split is balanced, but only the current event is
  saved. When the other event is later run, the first one is fixed and respected.
* *Run selection for Team A and Team B together*: both editable events are recomputed and
  saved (manual moves are lost, the app asks first).

Example: Team A has 6 applicants (p1–p6), Team B only 3 (p1, p2, p7), 3 starter places
each. B is scarcer (3/3 = 1.0 vs 6/3 = 2.0): B gets p1, p2, p7 as starters; A is selected
without p1, p2 → p3, p4, p5 start, p6 substitute, p1 and p2 *Not selected – Starter in
Team B this week*.

## 7. Manual overrides

In step 2 an R4 can **move** a player to another group or **swap** two players.
Overridden players get a "Manual" badge and the reason shows what happened.
A move or swap that breaks section 6 (e.g. making a Team B starter a Team A substitute)
is **refused by the domain rule** (`placementConflict`) with a clear message.
"Re-run selection" recomputes everything and discards manual changes.

If registrations change after the selection (a forgotten voter, a withdrawal),
the app offers to **keep the plan** (late registrations become the last
substitutes – or *Not selected* when they start in the other event – and withdrawn
players are removed) or to **re-run**.

## 8. What counts as "played"

| Situation | Played? |
| --- | --- |
| Core or rotation starter who entered | yes |
| Substitute who was called in and entered | yes |
| Substitute not used | **no** – keeps rotation priority |
| Absent starter | no |
| Not selected | no |

**Participation rate** (Roster screen) = **weeks played ÷ weeks registered**, Team A and
Team B combined. A week where the member registered for **both** events and played **one**
is a played week: **1/1, not a no-show** (a player can only play once per week). A week
where they registered for both and played none is 0/1. "–" means the member never
registered for a finalised week. **Last played** counts finalised weeks since the last one
played ("last week" = played in the most recent finalised week).

## 9. No-show penalty

When an event is finalised, for every player of **that event's** lineup:

| Group | Entered | Notified an R4 / arranged a sub | Result |
| --- | --- | --- | --- |
| Core or rotation | yes | – | played, no penalty |
| Core or rotation | no | **yes** (even late) | no penalty |
| Core or rotation | no | **no** | **suspended** for `suspension length` weeks |
| Substitute | any | any | **never** penalised |

* Penalties apply per event the player was assigned to (Team A and Team B are finalised
  separately).
* R4 members follow exactly the same rule.
* Suspension length 0 disables penalties.
* A suspension excludes the member from selection in **both** events (they can still be
  ticked; they will show as *Not selected – Suspended*).

### Countdown (counted in weeks)

Each **week**, when its **first** event is finalised (usually Team B, which plays first),
every active suspension that existed **before** that event loses one week. Finalising the
second event of the same week does not count down again. New suspensions start counting
at the next week.

Example with length 2:

| Week | What happens | Remaining |
| --- | --- | --- |
| W1 | X is a Team B starter, does not show, did not notify → suspended | 2 |
| W2 | X excluded from A and B; first event of W2 finalised → countdown | 1 |
| W3 | X excluded; first event of W3 finalised → countdown | 0 |
| W4 | X eligible again | – |

(If W1's Team A is selected **after** Team B was finalised, X is also excluded from W1's
Team A – the suspension applies immediately.)

Finalising checks that the stored suspensions did not change since they were read; if the
other event of the week was finalised at the same moment, the app reloads and asks to
finalise again, so suspensions are never lost or counted down twice.

An R4 can lift a suspension early from the member's page (Roster).

## 10. Public join page

Players open `#/join?code=…` (no login), pick their name from the **active roster** (no
free text, so no typos or duplicates), enter their current power and answer for each
event. Mapping to the registration model (`domain/join/joinRules.ts`):

| Answer for an event | Registration |
| --- | --- |
| Not available | none (removes an earlier **self**-registration; a leader's registration is never removed) |
| Available to play | normal applicant (`substituteOnly` unset): may be core/rotation; if not picked, stays a substitute candidate as usual |
| Sub only | `substituteOnly: true`: never a starter |

Registrations are stored with `source: 'self'`, `submittedAt` and `enteredPower`.
Sending again **updates** the same registration (same position in the list, never a
duplicate). Once an event leaves the *registration* status (selection run), it is
**closed** for self-registration: a submission choosing *play/sub* for it is refused as a
whole (the leaders' data wins); *not available* for a closed event is ignored.

**Power rule:** if the entered power is within **[−drop%, +rise%]** of the roster power
(defaults −10% / +30%) the roster is updated immediately and an *applied* history row is
written. Otherwise the roster is **not** changed, a *pending* change is created for the
leaders (one per member; resending updates it) and the player is **still registered**.
A member whose roster power is 0 accepts any value. Leader edits of power (roster form,
event screen, spreadsheet import) also write history rows.

"I'm not in the list" creates a pending **join request** (name, power, answers), merged
by normalised name per Friday. Leaders link it to an existing member (the typed name is
saved as an alias, the member is registered for the events requested if they are still
open, and the power rule applies) or create a new member from it, or reject it.

Limits (server side, mirrored by the in-memory repositories): power 1M–5B, names 2–32
characters, 6 submissions per member per 10 minutes, 3 requests per name per hour,
at most 30 pending requests. See `docs/BACKEND_SETUP.md`.
