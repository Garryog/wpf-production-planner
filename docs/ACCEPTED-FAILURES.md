# Accepted test failures (Garry to confirm each)
Updated 22 Oct 2026 after Stage 2 (branch `feature/stage2-imports`). Full suite: 385 pass, 7 fail — every failure is listed here.

| Test | Why it fails | Fixed in | Accepted? |
|---|---|---|---|
| stage1 t3 duplicate-WO delete-vs-edit | the merge can't tell two lines with the same WO apart. Stage 2 stops imports creating them (stage1 t8 now passes: a WO twice in one file = one job); existing duplicate lines still hit this | line IDs (Stage 3 per-row tables) | pending |
| stage1 t4 2,500-job merge >10 s | single-record size (passing on this run; may still be slow on a real PC) | Stage 3 | pending |
| sawstores attack-devices identical lines share one record | ticks keyed by line content | line IDs (before snags) | pending |
| sawstores attack-regress A4 label for waiting line | pre-existing | labels step | pending |
| baseline weeks.test.js "Monday 00:30 (summer time) is in the new week" | "this week" is worked out in UTC, so 00:00–01:00 on an Irish summer Monday still counts as last week. Not in the Stage 2 plan | weeks fix TBD | pending |
| baseline import.test.js "Messy/reordered headers" | test is stale: it expects Excel day 46330 to be 5 Nov 2026; 46330 is Wed 4 Nov (46331 = 5 Nov, as the other tests use). The mapping itself is right — tests/stage2 check 1 passes | Tester to update test | n/a |
| baseline import.test.js "€12,500 read as 12500 (14h)" | value IS read as 12500 (the bug is fixed). The 14h is stale: the Settings hour scale gives 16h above €12,000 (14h is up to €12,000). tests/stage2 check 6 uses the scale | Tester to update test (or Garry changes the scale) | n/a |
| sawstores attack-sheets "31 Dec → 1 Jan" | test is stale: 1 Jan is a bank holiday, Mon 4 Jan is correct | Tester to update test | n/a |

Fixed by Stage 2 and removed from this list: import.test.js (17 of 19), datasafety 3/5/6 (all 11 now pass), weeks 2 and 8 (and the year-end autoSchedule check), stage1 t5 "shipped job returns if edited elsewhere" (rewritten as acceptance check 27 — imports never remove a job, so it can't happen; stage1 t8 rewritten the same way).
