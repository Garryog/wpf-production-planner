# Accepted test failures (Garry to confirm each)
Updated 22 Oct 2026 after the Stage 2 round-2 fixes (branch `feature/stage2-imports`). Full suite incl. Stage 1 t1 ×5: 698 pass, 11 fail — every failure is listed here.

| Test | Why it fails | Fixed in | Accepted? |
|---|---|---|---|
| stage1 t3 duplicate-WO delete-vs-edit | the merge can't tell two lines with the same WO apart. Stage 2 stops imports creating them (stage1 t8 now passes: a WO twice in one file = one job); existing duplicate lines still hit this | line IDs (Stage 3 per-row tables) | pending |
| stage1 t4 2,500-job merge >10 s | single-record size (passing on this run; may still be slow on a real PC) | Stage 3 | pending |
| sawstores attack-devices identical lines share one record | ticks keyed by line content | line IDs (before snags) | pending |
| sawstores attack-regress A4 label for waiting line | pre-existing | labels step | pending |
| stage2 attack-r2-recheck 1 "re-show only for genuinely new work" (one bullet) | by design since R2 fix 2: a job changed on another PC that the import still writes to now always re-shows the preview, so the banner lists WO-1/2/3/4/5/6, not just WO-5. The other scenario-1 checks pass (B's date and week kept) | Tester to update test | pending |
| stage2 attack-r2-recheck 2 "WO-8 named as a new job" / "Keep and Move survive the re-show" (then the file stops with an error, so its scenarios 3–7 don't run) | by design since R2 fix 2/5: a job deleted on another PC during the preview is skipped and listed, not re-added, so there is no re-show. Scenarios 3–7 pass when scenario 2 is updated (Coder ran a copy) | Tester to update test | pending |
| stage2 attack-r2-ladder "hold keeps van/day/loaded fields" | by design since R2 fix 3: going on hold untags van/day (noted on the job and the On hold card); a LOADED job keeps everything | Tester to update test | pending |
| stage2 attack-r2-ladder "Undo complete respected" | test deletes completeAt directly instead of pressing "Undo complete", so no completeOverride is set. Pressing the button works (tests/stage2/coder-r2.test.js) | Tester to update test (click data-shu) | pending |
| stage2 attack-devices "WO-1 value 9000 applied" / "WO-9 added once" | by design since R2 fix 2: B hand-set WO-1 hours and moved WO-2 while the preview was open, so Apply re-shows instead of applying in one go; the test doesn't press Apply a second time | Tester to update test | pending |
| baseline weeks.test.js "Monday 00:30 (summer time) is in the new week" | "this week" is worked out in UTC, so 00:00–01:00 on an Irish summer Monday still counts as last week. Not in the Stage 2 plan | weeks fix TBD | pending |

Fixed by Stage 2 and removed from this list: import.test.js (17 of 19), datasafety 3/5/6 (all 11 now pass), weeks 2 and 8 (and the year-end autoSchedule check), stage1 t5 "shipped job returns if edited elsewhere" (rewritten as acceptance check 27 — imports never remove a job, so it can't happen; stage1 t8 rewritten the same way).
