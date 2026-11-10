-- Tester attack round 3 (Job B part 3): the SQL matching key and the claim rule in seq_insert, on a THROWAWAY local Postgres
-- set up like tests/seq/pg-check.sql (all blocks of SUPABASE_CHANGES.md run first). Never run this against the live project.
-- Run FROM THE REPO ROOT:  psql -d <throwaway db> -f tests/seq/attack3-pg.sql
-- It does not stop at the first failure: every check prints PASS / FAIL (as a NOTICE) and the last line says how many failed.
\set a3fx `cat tests/seq/attack3-pairs.json`
create temp table a3fx as select :'a3fx'::jsonb as j;
create temp table a3res(n serial, ok boolean, what text);
grant all on a3res to anon; grant all on sequence a3res_n_seq to anon; grant select on a3fx to anon;
create or replace function pg_temp.rec(p_ok boolean, p_what text, p_detail text default null) returns void language plpgsql as $$
begin p_ok := coalesce(p_ok,false); insert into a3res(ok,what) values(p_ok,p_what); -- a null result counts as a failure
  raise notice '% % %', case when p_ok then 'PASS' else 'FAIL' end, p_what, case when p_ok or p_detail is null then '' else '  -> '||p_detail end; end $$;

-- ---- 1. a pair a careful person would NOT call the same house never shares a database key (JS = SQL itself: attack4-jsvssql)
do $$ declare c jsonb; ha text; hb text;
begin
 for c in select * from jsonb_array_elements((select j from a3fx)->'pairs') loop
   ha := seq_house_key(c->'a'->>'floor',c->'a'->>'unit'); hb := seq_house_key(c->'b'->>'floor',c->'b'->>'unit');
   if c->>'careful' in ('different','not-same','unsure') then
     perform pg_temp.rec(coalesce(ha is null or hb is null or ha<>hb, true), '[HIGH] database never treats as the same house: pair '||(c->>'n')||' '||(c->>'what'), coalesce(ha,'null')||' / '||coalesce(hb,'null'));
   end if;
 end loop;
end $$;

-- ---- 2. the claim rule in seq_insert
update production_planner set settings=jsonb_build_object('listStore','migrating') where id='main' and coalesce(settings->>'listStore','v1')='v1';
update production_planner set settings=jsonb_build_object('listStore','v2') where id='main' and settings->>'listStore'='migrating';
insert into projects(id,name) values('AP1','A3 Basement'),('AP2','A3 TBC'),('AP3','A3 Kind'),('AP4','A3 Removed'),('AP5','A3 Twins'),('AP6','A3 Blank'),('AP7','A3 Order')
  on conflict do nothing;
set role anon;
do $$ declare j jsonb; n int;
begin
 -- a. basement "-1" vs first floor "1": the first-floor kitchen line is a different house and must be ADDED
 j := seq_insert('AP1','[{"id":"A1S","wo":"AWO-1","floor":"-1","unit":"7","descr":"HOUSE TYPE A","kind":"kitchen","src":"start","match_how":"start"}]'::jsonb,null,'John Burke');
 j := seq_insert('AP1','[{"id":"A1U","floor":"1","unit":"7","product":"K8","name":"HOUSE TYPE A","kind":"kitchen","src":"upload","line_no":1}]'::jsonb,null,'John Burke');
 perform pg_temp.rec(j->'added'='["A1U"]'::jsonb, '[HIGH] upload line floor 1 / unit 7 is not claimed by the basement (-1 / 7) Start row — it would be silently skipped', j::text);

 -- b. unit "TBC" on both: two different houses not known yet — must not be claimed silently
 j := seq_insert('AP2','[{"id":"A2S","wo":"AWO-2","floor":"T09","unit":"TBC","descr":"HOUSE TYPE B","kind":"kitchen","src":"start","match_how":"start"}]'::jsonb,null,'John Burke');
 j := seq_insert('AP2','[{"id":"A2U","floor":"T09","unit":"TBC","product":"K8","name":"HOUSE TYPE C","kind":"kitchen","src":"upload","line_no":1}]'::jsonb,null,'John Burke');
 perform pg_temp.rec(j->'added'='["A2U"]'::jsonb, '[HIGH] unit "TBC" line is not silently claimed by another "TBC" Start row', j::text);

 -- c. "Start the sequence" stores kind = seqKind(title). Round 4: the planner now sends 'kitchen' for "UNIT 22 TYPE B 3 BED SEMI -
 --    KITCHEN" (attack3-key checks seqKind), so this sends what the planner sends: the kitchen line must claim the Start row
 j := seq_insert('AP3','[{"id":"A3S","wo":"AWO-3","floor":"T09","unit":"22","descr":"UNIT 22 TYPE B 3 BED SEMI - KITCHEN","kind":"kitchen","src":"start","match_how":"start"}]'::jsonb,null,'John Burke');
 j := seq_insert('AP3','[{"id":"A3U","floor":"T09","unit":"22","product":"K8","name":"HOUSE TYPE B","kind":"kitchen","src":"upload","line_no":1}]'::jsonb,null,'John Burke');
 perform pg_temp.rec(jsonb_array_length(j->'added')=0, '[HIGH] the kitchen line of a house whose Cienapps kitchen says "3 BED" claims its Start row — no second kitchen row', j::text);
 -- a utility line never claims a kitchen Start row (passes)
 j := seq_insert('AP3','[{"id":"A3K","wo":"AWO-4","floor":"T09","unit":"23","descr":"HOUSE TYPE B","kind":"kitchen","src":"start","match_how":"start"}]'::jsonb,null,'John Burke');
 j := seq_insert('AP3','[{"id":"A3V","floor":"T09","unit":"23","product":"K2","name":"HOUSE TYPE B UTILITY","kind":"utility","src":"upload","line_no":1}]'::jsonb,null,'John Burke');
 perform pg_temp.rec(j->'added'='["A3V"]'::jsonb, 'a utility line does not claim the kitchen Start row', j::text);

 -- d. a removed Start row is never claimed; an unmatched one still is (and keeps its place)
 j := seq_insert('AP4','[{"id":"A4S","wo":"AWO-5","floor":"T09","unit":"30","descr":"HOUSE TYPE A","kind":"kitchen","src":"start","match_how":"start"},
   {"id":"A4T","wo":"AWO-6","floor":"T09","unit":"31","descr":"HOUSE TYPE A","kind":"kitchen","src":"start","match_how":"start"}]'::jsonb,null,'John Burke');
 j := seq_remove('A4S',null,'Mary','wrong'); perform pg_temp.rec((j->>'ok')::boolean, 'remove Start row A4S', j::text);
 j := seq_unmatch('A4T',null,'Mary','wrong WO'); perform pg_temp.rec((j->>'ok')::boolean, 'unmatch Start row A4T', j::text);
 j := seq_insert('AP4','[{"id":"A4U","floor":"T09","unit":"30","product":"K8","name":"HOUSE TYPE A","kind":"kitchen","line_no":1},
   {"id":"A4V","floor":"T09","unit":"31","product":"K8","name":"HOUSE TYPE A","kind":"kitchen","line_no":2}]'::jsonb,null,'John Burke');
 perform pg_temp.rec(j->'added'='["A4U"]'::jsonb and j->'skipped'->0->>'existing_id'='A4T', 'removed Start row not claimed (line added); unmatched Start row claimed', j::text);

 -- e. identical lines: 3 the first time, a file of 2 adds 0, a file of 4 adds 1
 j := seq_insert('AP5','[{"id":"A5a","floor":"T09","unit":"40","product":"W2","name":"BED 2","kind":"robes"},{"id":"A5b","floor":"T09","unit":"40","product":"W2","name":"BED 2","kind":"robes"},{"id":"A5c","floor":"T09","unit":"40","product":"W2","name":"BED 2","kind":"robes"}]'::jsonb,null,'x');
 perform pg_temp.rec(jsonb_array_length(j->'added')=3, 'three identical robes lines → 3 rows', j::text);
 j := seq_insert('AP5','[{"id":"A5d","floor":"t09 ","unit":"Apt 040","product":"w2","name":"bed 2 ","kind":"robes"},{"id":"A5e","floor":"T9","unit":"40","product":"W2","name":"BED  2","kind":"robes"}]'::jsonb,null,'x');
 perform pg_temp.rec(jsonb_array_length(j->'added')=0, 'a file with 2 of them (typed differently) adds 0', j::text);
 j := seq_insert('AP5','[{"id":"A5f","floor":"T09","unit":"40","product":"W2","name":"BED 2"},{"id":"A5g","floor":"T09","unit":"40","product":"W2","name":"BED 2"},{"id":"A5h","floor":"T09","unit":"40","product":"W2","name":"BED 2"},{"id":"A5i","floor":"T09","unit":"40","product":"W2","name":"BED 2"}]'::jsonb,null,'x');
 perform pg_temp.rec(j->'added'='["A5i"]'::jsonb, 'a file with 4 adds 1 (the 4th)', j::text);

 -- f. the same file twice when a line has no product and no name (line key null): must still add 0 the second time
 j := seq_insert('AP6','[{"id":"A6a","floor":"T09","unit":"50","kind":"kitchen","descr":"KITCHEN","line_no":1}]'::jsonb,null,'x');
 j := seq_insert('AP6','[{"id":"A6b","floor":"T09","unit":"50","kind":"kitchen","descr":"KITCHEN","line_no":1}]'::jsonb,null,'x');
 perform pg_temp.rec(jsonb_array_length(j->'added')=0, '[MEDIUM] same file twice, a line with no product / name (only floor, unit, description) → 0 added the second time', j::text);
 j := seq_insert('AP6','[{"id":"A6c","floor":"T09","unit":"51","product":" ","name":"-","kind":"kitchen","line_no":1}]'::jsonb,null,'x');
 j := seq_insert('AP6','[{"id":"A6d","floor":"T09","unit":"51","product":" ","name":"-","kind":"kitchen","line_no":1}]'::jsonb,null,'x');
 perform pg_temp.rec(jsonb_array_length(j->'added')=0, '[MEDIUM] same file twice, product " " / name "-" → 0 added the second time', j::text);

 -- g. file order decides which kitchen-kind line takes the Start row (information: a person is never asked)
 j := seq_insert('AP7','[{"id":"A7S","wo":"AWO-7","floor":"T09","unit":"60","descr":"HOUSE TYPE B","kind":"kitchen","src":"start","match_how":"start"}]'::jsonb,null,'x');
 j := seq_insert('AP7','[{"id":"A7I","floor":"T09","unit":"60","product":"K9","name":"HOUSE TYPE B ISLAND","kind":"kitchen","line_no":1},{"id":"A7K","floor":"T09","unit":"60","product":"K8","name":"HOUSE TYPE B","kind":"kitchen","line_no":2}]'::jsonb,null,'x');
 -- [MEDIUM] the KITCHEN line should take the kitchen's Start row; the island line (file order first) takes it instead
 perform pg_temp.rec(j->'added'='["A7I"]'::jsonb, '[MEDIUM] island line listed first: the KITCHEN line still claims the kitchen Start row (today file order decides, nobody is asked)', j::text);
end $$;
reset role;
do $$ declare f int; t int; begin select count(*) filter (where not ok), count(*) into f, t from a3res;
  raise notice '% failed of %', f, t; end $$;
