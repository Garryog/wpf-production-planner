# Design: checking a save whose reply was lost

Written by the Architect, 3 Nov 2026, at the Manager's request. Describes the code at commit a2ab59c (stage2-imports) / 1eced78 (cutting-lists).

## For Garry: the short version

**The problem.** A screen sends a save, for example a saw operator ticks a cutting list "done". The save reaches the database, but the "saved OK" reply never comes back to the screen because the Wi-Fi dropped for a moment. Meanwhile the office unticks the same list. If the operator's screen assumes its tick never arrived and sends it again, the tick comes back over the office's untick. That is wrong, and nobody would notice.

**The fix.** When a reply goes missing, the screen doesn't guess. It looks at the database several times over the next 5 seconds to find out what happened:

| What the screen finds | What it means | What it does |
|---|---|---|
| The database holds exactly what it sent | The save landed | Carries on as normal |
| Its save tag is in the database, but someone else has saved since | It landed, then someone saved over it | Treats its save as done. Their later changes (e.g. the untick) are kept |
| Another screen saved first, so this save could not have gone in | Not landed | Merges the other person's changes in and saves again straight away |
| The database has not moved yet | Not landed **yet** (it could still arrive) | Saves again, but keeps the first save on a "may have landed" list so it can never be mistaken for someone else's change |
| No signal, or someone saved over it and no tag can be found | Can't tell | Keeps the save on the "may have landed" list, shows "Save failed — will retry", and retries every 30 s |

**Save tags.** Every save that changes something carries a short random code, the "save tag". The database keeps the last 40 tags from all screens. A tag lets a screen prove "my save got in" even after someone else has saved on top of it.

**What staff see.** Usually nothing; the check takes under 5 seconds. If someone closes the tab or refreshes during a save, the browser asks **"Leave page?"**. Staff should **press Stay**.

**Old screens.** Any tab still running today's live version (`main`) doesn't know about save tags and throws them away when it saves. New screens then fall back to "can't tell". That is safe, because nothing comes back wrongly, but they show "Save failed — will retry" more often until every device has the new version. **On go-live day, close and reopen the planner on every PC, tablet and phone.**

---

## Technical section (for future coders)

**Where it is (index.html).** `pushPlan`, `saveCheck`, `unsureAdd`/`unsureKeep`/`unsureDel`/`unsureLanded`, `newSaveId` (`SAVEID_N = 40`), `m3`/`mergePlan` (`o.unsure`, `NOU`), the `loadDB` merge path, `beforeunload`, `SAVE_OVERS`/`LAST_OVER`.

**Versioned save.** Each save is a PATCH sent as `id=eq.main&version=eq.VER` with body `version: VER+1`. The database trigger also sets old+1, so old-code tabs bump the number too. An empty reply array means another screen saved first: fetch, `mergePlan(base, mine, theirs)`, then go again (up to 6 rounds).

**UNSURE list.**
- `unsureAdd(mine, VER+1)` runs *before* the fetch. The tab may close mid-save, and the device copy carries the record into the next open.
- `USV` holds the version each sent plan would have written; `USID` holds its tag.
- In `m3`, if the database value equals what an unsure save sent, that sent value becomes the merge base.
- `unsureDel` runs only on a definite "did not land".
- `unsureKeep(row)` drops entries at or below the loaded version.
- `unsureLanded(row)` finds the newest entry whose tag is in `row.settings.saveIds`. That entry becomes the merge base, and it and all older entries are dropped.

**saveCheck(p, v, tok).** It reads the row at about 0.05, 0.25, 0.6, 1.2, 2, 3 and 4 s, stopping after 5 s. A failed read just waits for the next look. Outcomes:
- Version ≥ v and the content equals `p` → it landed (normal success).
- Version ≥ v, content differs, and `tok` is in `saveIds` → `{over: v}`. The screen sets `VER=v`, `BASE=mine`, clears `UNSURE`, and bumps `SAVE_OVERS`/`LAST_OVER`. The next save merges their changes against ours, so their untick survives.
- Version = v with other content → `'lost'`. The screen calls `unsureDel` and re-sends.
- Version > v with no tag → `''` ("can't tell"). The save throws, stays in `UNSURE`, and retries after 30 s.
- Still below v at the 0.25 s look (or the database answered once and then went quiet) → `'slow'` (a2ab59c). The save is re-sent at the same version but **kept** in `UNSURE` with its tag. Whichever request lands first wins, and the other is refused by the version check. If the slow one won, the next merge finds its tag and uses it as the base.
- The database never answered → `''`.

**Save tags.** `newSaveId()` makes a tag from 5 characters of the clock plus 5 random characters, and keeps only the last 40 in `DB.saveIds`. A save that changes nothing gets no new tag. An identical re-send reuses its tag. Tags are carried by `fullSettings`/`planOf`/`applyPlan` and merged as a set. **Limit:** if more than 40 tagged saves land while a screen is waiting, its tag has dropped off and it falls back to "can't tell". That is safe but noisy.

**Old-code tabs.** They drop `saveIds`, so the outcome becomes "can't tell". The content-match rule in `m3` still protects the untick when the database value equals what we sent. Old tabs keep their own old "tick comes back" risk on their own lost replies.

**beforeunload.** The leave-page warning shows when `saveT || SAVING || DB.saveFailed` is set (on the cutting-lists branch, also `lqPending()`).

## Known limits and risks
- Phone Chrome often skips "Leave page?". A phone closed mid-check relies on the device copy being recovered at next open.
- "Can't tell" can show a false "Save failed" while old-code tabs are still open.
- The 5 s check holds `SAVING`. Refreshes are skipped and taps are queued, so the screen can feel slow on a poor signal.
- Safari on iPhone is not supported.

## Must be tested on a Supabase TEST project before go-live (never the live row)
1. Save lands but its reply is lost → no "Save failed", and no second copy.
2. As 1, and a second screen unticks within 1 s → the untick stays on both screens after a refresh.
3. Another screen saves first, ours is refused, and the reply is lost → our change is merged and nothing is lost.
4. Our request arrives 0.5–3 s late, with an untick in between → the tick never comes back, whichever request lands first.
5. A live-`main` tab saves in between (tags wiped) → "can't tell", the untick stays, and the retry succeeds.
6. More than 40 saves from other screens during an offline spell → safe fallback.
7. 5 minutes offline with edits, then back → everything is saved, with no duplicates.
8. Close the tab during a check → "Leave page?" shows on PC Chrome; on phone Chrome, the changes come back on reopen.
9. Before any of this, check that the version column and trigger exist on TEST (`SUPABASE_CHANGES.md`).

## Architect concerns
1. Old-code tabs wipe `saveIds`, so tag protection is mostly off until every device has the new code. Plan a forced refresh on go-live day.
2. The tag list is only trimmed when a new tag is made, so after merges it can go a little past 40. That is harmless, and tests should not assume exactly 40.
3. Confirm the live `main` code saves with the version check. If it doesn't, an old tab can overwrite a new tab's save without merging. That is the biggest risk while both versions are running.
4. Any new code that needs "did my save get saved over?" must compare `SAVE_OVERS` before and after the save, not just read `LAST_OVER`.
