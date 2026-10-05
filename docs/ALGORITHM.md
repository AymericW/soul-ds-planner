# Selection and penalty rules

Everything on this page is implemented as small, pure functions in `src/domain/`
(no screen, no storage) and covered by unit tests in `tests/domain/`.
Given the same roster, history and settings, the result is always the same.

| Rule | Code | Tests |
| --- | --- | --- |
| Relative score | `domain/scoring/relativeScore.ts` | `tests/domain/scoring.test.ts` |
| Close scores → activity wins | `domain/scoring/coreRanking.ts` | `tests/domain/scoring.test.ts` |
| Eligibility | `domain/selection/eligibility.ts` | `tests/domain/selection.test.ts` |
| Core / rotation / substitutes | `domain/selection/{core,rotation,substitutes,runSelection}.ts` | `tests/domain/selection.test.ts` |
| Manual overrides | `domain/selection/overrides.ts` | `tests/domain/overrides.test.ts` |
| Played / participation | `domain/history/*.ts` | `tests/domain/history.test.ts` |
| No-show penalty, countdown | `domain/penalties/*.ts` | `tests/domain/penalties.test.ts` |

## 1. Settings (all configurable in the app)

| Setting | Default | Meaning |
| --- | --- | --- |
| Core starters | 14 | Best relative scores |
| Rotation starters | 6 | Fair turn for those who waited longest |
| Substitutes | 10 | Called in, in order, when a starter is missing |
| Suspension length | 2 | Team A events a no-show is excluded for |
| Weights | 70% power / 30% activity | Used for the core score |
| Tie margin (ε) | 0.02 | Scores this close are "too close to call" |

**Starters** = core + rotation (default 20).
**Registration cap** = starters + substitutes (default 30).

## 2. Who can be selected (eligibility)

Only members who registered (ticked in step 1) **and** are

* marked **active**, and
* **not currently suspended**.

Ineligible applicants are listed under *Not selected* with the reason
("Inactive member", "Suspended – 2 events left").

## 3. Core: relative score

The core is **not** "the 14 strongest". Each eligible applicant gets a score
between 0 and 1, computed against **this week's pool of eligible applicants**:

```
powerRatio  = power / (highest power among this week's eligible applicants)
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

## 4. Rotation priority

Rotation places go to eligible applicants **not in the core**, ordered by:

1. **Did not play the last finalised event** comes first.
2. **Longest time since last played** (events counted, not weeks;
   *never played* counts as the longest).
3. Tie-break: **higher activity**, then **higher power**, then name.

The first `rotationStarters` become rotation starters.

### Worked example

History of the last finalised events (oldest → newest): E1, E2, E3.

| Player | Last played | Played last event (E3)? | Priority |
| --- | --- | --- | --- |
| P | never | no | 1st |
| Q | E1 (2 events ago) | no | 2nd (tie with R: same activity, more power) |
| R | E1 (2 events ago) | no | 3rd |
| S | E2 (1 event ago) | no | 4th |
| T | E3 | **yes** | last |

With 2 rotation places: P and Q are rotation starters; R, S, T go on to the substitutes.

## 5. Substitutes and the cap

After the rotation, the next `substitutes` players by the **same rotation
priority** are substitutes (their order = the call-in order).

* **Under the cap** (fewer eligible applicants than starters + substitutes):
  nobody is cut. Starters are filled first (core, then rotation) and everyone
  else is a substitute. Example: 25 applicants with 14/6/10 → 14 core, 6 rotation,
  5 substitutes, 0 not selected. 5 applicants → 5 core.
* **Over the cap**: whoever is left after the substitutes is *Not selected*
  ("Over the cap of 30 – lower rotation priority"). Because they did not play,
  their rotation priority rises for next week.

## 6. Manual overrides

In step 2 an R4 can **move** a player to another group or **swap** two players.
Overridden players get a "Manual" badge and the reason shows what happened.
"Re-run selection" recomputes everything and discards manual changes.

If registrations change after the selection (a forgotten voter, a withdrawal),
the app offers to **keep the plan** (late registrations become the last
substitutes, withdrawn players are removed) or to **re-run**.

## 7. What counts as "played"

| Situation | Played? |
| --- | --- |
| Core or rotation starter who entered | yes |
| Substitute who was called in and entered | yes |
| Substitute not used | **no** – keeps rotation priority |
| Absent starter | no |
| Not selected | no |

**Participation rate** (Roster screen) = times played ÷ finalised events the
member registered for. "–" means the member never registered for a finalised
event. **Last played** counts finalised events since the last one played
("last event" = played in the most recent one).

## 8. No-show penalty

When an event is finalised, for every player of the lineup:

| Group | Entered | Notified an R4 / arranged a sub | Result |
| --- | --- | --- | --- |
| Core or rotation | yes | – | played, no penalty |
| Core or rotation | no | **yes** (even late) | no penalty |
| Core or rotation | no | **no** | **suspended** for `suspensionEvents` events |
| Substitute | any | any | **never** penalised |

* R4 members follow exactly the same rule.
* Suspension length 0 disables penalties.
* A suspension excludes the member from selection (they can still be ticked in
  the poll; they will show as *Not selected – Suspended*).

### Countdown (counted in Team A events, not weeks)

Each time a Team A event is **finalised**, every active suspension that existed
**before** that event loses one event. New suspensions of that same event start
counting at the next one.

Example with length 2:

| Event | What happens | Remaining |
| --- | --- | --- |
| E1 | X is a starter, does not show, did not notify → suspended | 2 |
| E2 | X excluded from selection; E2 finalised → countdown | 1 |
| E3 | X excluded; E3 finalised → countdown | 0 |
| E4 | X eligible again | – |

An R4 can lift a suspension early from the member's page (Roster).
