---
name: addwords
description: Use when the user pastes a feed dump, screenshot text, or list of posts that "didn't get filtered" / slipped through / are "blind spots" and wants the missed keywords added to the keyword catalog. Triggers on Reddit/Bluesky/news feed dumps of unblocked political content, "find others that should be blocked", "add these", missed names or slurs.
---

# addwords — extract missed keywords from a feed and add them to the catalog

## Source of truth: edit calm-the-chaos, not MuteSky

Per this repo's `AGENTS.md`, the authoritative catalog of permanent keyword categories lives in the **`calm-the-chaos`** repo, checked out locally at **`c:/github/calm-the-chaos`**. MuteSky *consumes* that catalog. So this skill edits the category files under `c:/github/calm-the-chaos/keywords/categories/` and validates with `npm test` **in that repo** — never MuteSky's own `keywords/` (which only holds trending/holiday client metadata). All paths below are absolute into calm-the-chaos.

## Overview

The user pastes unfiltered content (e.g. r/politics or Bluesky posts that slipped past the filter). Extract the recurring names and charged terms that *should* have been blocked, then add them to the right category files with correct schema, weight, lifecycle, and alphabetical placement. **The final gate is `npm test` in calm-the-chaos — it must stay green.**

Core principle: **add the broadest safe root, in the right category, without duplicates, and let `npm test` prove it.**

## Workflow

1. **Extract candidates.** Pull from the dump: recurring political figures (surnames + full names), advocacy orgs, inflammatory/attack terms, slurs, and incident/victim names. **Rank by repetition** — a name appearing 4× is a stronger signal than one appearing once. The user's examples (e.g. "mamdani", "pedophile") show the *kind* of thing they want.

2. **Prefer the broadest safe root.** Add `shooting`, not `ICE shooting`; `rape`/`rapist`, not `date rape at rally`. Before adding a compound, grep for a root that already covers it (or should be added instead). One good root beats five headline fragments — the curator retires headline fragments (see retired `"ICE confirms"`, `"Texas hospitals"` in `catalog-migrations.json`).
   - **Verify the root literally substring-matches the post text.** The matcher is substring-based, so an existing `shooting` entry does NOT cover "opens fire" or "sniper," `mosque attack` does NOT cover "mosque burned," and `protest` does NOT cover "riot." If no *active* keyword appears verbatim in the headline, the post is still a blind spot — add a root that does (`sniper`, `mosque`, `riot`). Never conclude "already covered" without confirming the match.

3. **Check existing coverage + retirements.** For every candidate:
   ```bash
   grep -rli "candidate" c:/github/calm-the-chaos/keywords/categories/     # already present? in which file?
   grep -i "candidate" c:/github/calm-the-chaos/keywords/catalog-migrations.json   # was it deliberately retired?
   ```
   Skip anything already active. Do **not** re-add a term listed as `retire` in the manifest — the test fails if a retired keyword is active again.

4. **Map to a category** (see table) and **assign weight** (see table). People go in BOTH `us-political-figures-single-name.json` (surname) and `us-political-figures-full-name.json` (full name) — but only add a surname if it is distinctive AND unambiguous across people: add "Paxton"; skip a bare "Lee" (too common), and skip a surname that collides with a *different* public figure (e.g. "Shapiro" = a governor and a pundit — full name only).

5. **Set lifecycle:**
   - Political figures → `tenure` (inherited from the category header; no per-entry field needed).
   - Durable concepts/slogans/policy → `evergreen` (add `"lifecycle": "evergreen"` per entry in mixed-lifecycle files like immigration, or omit — missing = evergreen).
   - An incident, victim, suspect, or single-story name → `event`. Put it in `new-developments.json` (its category header is already `event`, so sort its keys by the full string as written) OR in the relevant durable category with `"lifecycle": "event"`. **Every event entry REQUIRES** `"reviewAfter": "YYYY-MM-DD"` set about a month out (next month's date) — a future date that matches the style of existing event dates, which automatically satisfies the test's `>= reviewedAt` check.
   - **A developing incident often yields BOTH a one-off name and a reusable root** — different terms, add both: the act/weapon root (`sniper`, `arson`) in its topical category (`gun-policy`/`political-violence-and-security-threats`) as evergreen, and the person/victim/suspect name in `new-developments` as an event.

6. **Insert alphabetically** (case-insensitive) into the category's `keywords` object. Match the file's 12/16-space indentation. Find neighbors with:
   ```bash
   grep -nE '^\s+"[Pp][^"]*":' c:/github/calm-the-chaos/keywords/categories/us-political-figures-full-name.json
   ```

7. **Avoid substring false positives.** The matcher is substring-based, so a short root hides unrelated words: `pedo`→torpedo/speedo, ` ice `→justice/police, `rape`→drapery. If a root is risky, either drop it, use a longer form, or note the risk in its `description` and flag it to the user.

8. **Bump the catalog version.** In `c:/github/calm-the-chaos/keywords/catalog-migrations.json`, bump the `catalogVersion` patch (e.g. `2026.07.4` → `2026.07.5`) so clients fetch the additions. `catalogVersion` may already read ahead of the newest `migrations` entry — that is a prior pure-addition bump, not a mistake; just bump the patch again. Pure additions need NO migration entry — migrations are only for retire/rename/move.

9. **Validate.** Run tests in the calm-the-chaos repo:
   ```bash
   cd c:/github/calm-the-chaos && npm test
   ```
   All tests must pass (schema, no duplicate identities, lifecycle-review dates, manifest alignment). Fix any failure before reporting. Then summarize what was added, grouped by category, and list anything you deliberately held back for the user to decide.

## Category map

| Candidate type | File (under `c:/github/calm-the-chaos/keywords/categories/`) |
|---|---|
| US politician surname | `us-political-figures-single-name.json` |
| US politician full name | `us-political-figures-full-name.json` |
| Foreign head of state/gov | `world-leaders.json` (current leaders weight 0) |
| Pundit / media figure | `media-personalities.json` |
| Party / movement / advocacy org | `political-organizations.json` |
| Attack terms, slurs, charged rhetoric | `political-rhetoric.json` |
| Extremism, threats, violence-at-events | `political-violence-and-security-threats.json` |
| Racial-conflict terms, hate symbols | `race-relations.json` |
| Religious conflict / hate | `religion.json` |
| Sexual/interpersonal violence | `relational-violence.json` |
| Shootings, gun incidents | `gun-policy.json` |
| ICE / border / deportation | `immigration.json` |
| Developing incident / victim / suspect | `new-developments.json` (event + `reviewAfter`) |

Federal agencies → `us-government-institutions.json`; weapons/military → `military-and-defense.json`; and the other topical files by name.

## Weight guide

`3` highest-priority default · `2` strong default · `1` regular default · `0` catalog-only, **excluded from default filtering** (used for over-broad or neutral names). Weight ≥1 to actually filter. Rule of thumb: currently dominating a news cycle → 3; recurring figure/term → 2; lower-profile or regional → 1; too generic to filter safely → 0.

## Entry schema

```json
"keyword": {
    "weight": 2,
    "description": "Short reason this is charged/relevant",
    "lifecycle": "evergreen"
}
```
`lifecycle` is optional (defaults to the category header, else `evergreen`). `reviewAfter` is **only** valid on `event` entries and is **required** for them.

## Common mistakes

- **Editing MuteSky's `keywords/` instead of calm-the-chaos** → wrong repo. Permanent categories live in calm-the-chaos.
- **Duplicate identity** → `npm test` fails. Case/space-insensitive; "Mamdani" (single) and "Zohran Mamdani" (full) are different identities and both fine, but don't add a term that already exists.
- **Event entry with no `reviewAfter`, or a past date** → test fails. Use a future date.
- **Re-adding a retired keyword** → test fails. Grep `catalog-migrations.json` first.
- **Bare surname too broad** ("Lee", "Scott") → full name only.
- **Headline fragment instead of a root** → prefer the durable root.
