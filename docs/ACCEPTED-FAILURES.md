# Accepted test failures (Garry to confirm each)
| Test | Why it fails | Fixed in | Accepted? |
|---|---|---|---|
| stage1 t3 duplicate-WO delete-vs-edit | needs import dedupe | Stage 2 | pending |
| stage1 t5 shipped job returns if edited elsewhere | import removal vs concurrent edit; not exported; next import clears | Stage 2 ("shipped ≠ complete" changes this anyway) | pending |
| stage1 t4 2,500-job merge >10 s | single-record size | Stage 3 | pending |
| sawstores attack-devices identical lines share one record | ticks keyed by line content | line IDs (before snags) | pending |
| sawstores attack-regress A4 label for waiting line | pre-existing | labels step | pending |
| baseline import.test.js (19) / weeks (4) / datasafety (remaining) | original 19 Oct baseline bugs | Stage 2 (imports), weeks fix TBD | pending |
| sawstores attack-sheets "31 Dec → 1 Jan" | test is stale: 1 Jan is a bank holiday, Mon 4 Jan is correct | Tester to update test | n/a |
