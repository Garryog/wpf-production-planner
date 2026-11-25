-- "Merged P-numbers stay merged" (SUPABASE_CHANGES.md, 11 Nov) on a THROWAWAY local Postgres. Never live.
-- Builds its own planner tables (orders/settings as jsonb, and as json), runs the block twice, then checks.
-- Run: psql -v ON_ERROR_STOP=1 -d <throwaway db> -f tests/seq/pg-pmerged.sql   → last line: ALL PMERGED CHECKS PASSED
drop table if exists production_planner;
create table production_planner(id text primary key, orders jsonb, settings jsonb, nid bigint);
\i tests/seq/pg-pmerged-block.sql
\i tests/seq/pg-pmerged-block.sql
\i tests/seq/pg-pmerged-checks.sql
drop table production_planner;
create table production_planner(id text primary key, orders json, settings json, nid bigint);
\i tests/seq/pg-pmerged-block.sql
\i tests/seq/pg-pmerged-checks.sql
select 'ALL PMERGED CHECKS PASSED';
