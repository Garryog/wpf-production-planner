-- PM sequence & pre-production: the SQL in SUPABASE_CHANGES.md ("PM sequence & pre-production" block) checked on a THROWAWAY
-- local Postgres set up like Supabase (roles anon / authenticated / service_role; Stage 1 + Stage 3 + Stores dockets + Project
-- details + PM sequence blocks run first, each twice). Never run this against the live project.
-- Run FROM THE REPO ROOT (it reads tests/seq/b0-pairs.json):
--   psql -v ON_ERROR_STOP=1 -d <throwaway db> -f tests/seq/pg-check.sql   → last line: ALL SEQ PG CHECKS PASSED
-- Every check raises an error (and stops) if it fails. Run it on a fresh throwaway database (it adds fixed ids).
-- B0 matching key (Job B part 3): the SQL key functions give exactly the strings in tests/seq/b0-pairs.json — the file the
-- planner's own functions are checked against (tests/seq/b0-key.test.js) — and a pair that is not "same" never shares a key.
\set b0fx `cat tests/seq/b0-pairs.json`
create temp table b0fx as select :'b0fx'::jsonb as j;
do $$ declare fx jsonb := (select j from b0fx); c jsonb; ha text; hb text; n int := 0;
begin
 for c in select * from jsonb_array_elements(fx->'pairs') loop
   ha := seq_house_key(c->'a'->>'floor',c->'a'->>'unit'); hb := seq_house_key(c->'b'->>'floor',c->'b'->>'unit');
   if ha is distinct from (c->'hk'->>0) or hb is distinct from (c->'hk'->>1) then
     raise exception 'FAIL B0 pair % (%) house keys SQL % / % — fixture %',c->>'n',c->>'what',ha,hb,c->'hk'; end if;
   if coalesce((c->>'jsOnly')::boolean,false)=false then
     if c->>'r'<>'same' and ha is not null and ha=hb then raise exception 'FAIL B0 pair % (%) is %, but both get key %',c->>'n',c->>'what',c->>'r',ha; end if;
     if c->>'r'='same' and (ha is null or ha<>hb) then raise exception 'FAIL B0 pair % (%) is same, keys % / %',c->>'n',c->>'what',ha,hb; end if;
   end if;
   n := n+1;
 end loop;
 if n<60 then raise exception 'FAIL B0 fixture has only % pairs',n; end if;
 for c in select * from jsonb_array_elements(fx->'lines') loop
   if seq_line_key(c->>'f',c->>'u',c->>'p',c->>'name') is distinct from (c->>'lk') then
     raise exception 'FAIL B0 line % (%) SQL % — fixture %',c->>'n',c->>'what',seq_line_key(c->>'f',c->>'u',c->>'p',c->>'name'),c->>'lk'; end if;
 end loop;
 -- the parts on their own
 if seq_key_txt(' ｔ'||chr(8203)||'09 -- apt.'||chr(160)||'7 ')<>'T09 APT 7' then raise exception 'FAIL seq_key_txt'; end if;
 if seq_key_txt('Ré-sidence ß')<>'R SIDENCE' then raise exception 'FAIL seq_key_txt accents %',seq_key_txt('Ré-sidence ß'); end if;
 if seq_key_code('T 09')<>'T-9' or seq_key_code('0')<>'0' or seq_key_code('A00')<>'A-0' or seq_key_code(' - ')<>'' or seq_key_code(null)<>'' then raise exception 'FAIL seq_key_code'; end if;
 if seq_unit_key('NORTH 7')<>'NORTH-7' or seq_unit_key('Unit No 007')<>'7' or seq_unit_key(null)<>'' then raise exception 'FAIL seq_unit_key'; end if;
 if seq_floor_key(null)<>'' or seq_floor_key('third floor')<>'#3' or seq_floor_key('000')<>'#0' then raise exception 'FAIL seq_floor_key'; end if;
end $$;
update production_planner set settings=jsonb_build_object('listStore','migrating') where id='main' and coalesce(settings->>'listStore','v1')='v1';
update production_planner set settings=jsonb_build_object('listStore','v2') where id='main' and settings->>'listStore'='migrating';
insert into projects(id,name) values('QP1','Q Aderrig'),('QP2','Q Lucan') on conflict do nothing;
set role anon;
do $$ declare r record; j jsonb; n int; o text;
begin
 -- PM assignment (one or more PMs) is written to the history by the database
 if (select pms from projects where id='QP2')<>'{}'::text[] then raise exception 'FAIL pms default'; end if;
 update projects set pms=array['John Burke','Mary O''Neill'], updated_by='Office' where id='QP1';
 update projects set pms=array['Mary O''Neill'], updated_by='Prod' where id='QP1';
 select count(*) into n from project_events where entity='project' and entity_id='QP1' and act='pm'; if n<>2 then raise exception 'FAIL pm log count %',n; end if;
 select count(*) into n from project_events where entity='project' and entity_id='QP1' and act='pm' and by='Office'
   and old->'pms'='[]'::jsonb and new->'pms'='["John Burke","Mary O''Neill"]'::jsonb; if n<>1 then raise exception 'FAIL pm log add two'; end if;
 select count(*) into n from project_events where entity='project' and entity_id='QP1' and act='pm' and by='Prod'
   and old->'pms'='["John Burke","Mary O''Neill"]'::jsonb and new->'pms'='["Mary O''Neill"]'::jsonb; if n<>1 then raise exception 'FAIL pm log remove one'; end if;
 -- the old single pm column is no longer logged (kept, unused)
 update projects set pm='Someone', updated_by='Old' where id='QP1';
 select count(*) into n from project_events where entity='project' and entity_id='QP1' and act='pm'; if n<>2 then raise exception 'FAIL old pm column logged'; end if;
 update projects set seq_rules='{"follow":true,"offsets":{"robes":5}}', updated_by='John Burke' where id='QP1';
 select count(*) into n from project_events where entity='project' and act='rules'; if n<>1 then raise exception 'FAIL rules log'; end if;

 -- upload lines: one row each, bottom of the sequence, trailing spaces and no-break spaces tidied
 j := seq_insert('QP1', '[{"id":"Q1","floor":"T09 ","unit":"12","product":"K8","name":"HOUSE TYPE B ","kind":"kitchen","src":"upload","line_no":2,"children":[{"qty":1,"product":"FK1"}]},
   {"id":"Q2","floor":"T09","unit":"12","product":"K2","name":"HOUSE TYPE B UTILITY","kind":"utility","src":"upload","line_no":3},
   {"id":"Q3","floor":"T09","unit":"13","product":"K8","name":"HOUSE  TYPE C","kind":"kitchen","src":"upload","line_no":4},
   {"id":"Q4","floor":"T09","unit":"13","product":"W2","name":"BED 2","kind":"robes","src":"upload","line_no":5},
   {"id":"Q5","floor":"T09","unit":"13","product":"W2","name":"BED 2","kind":"robes","src":"upload","line_no":6}]'::jsonb, null, 'John Burke');
 -- (Garry 10 Nov) the two identical "W2 BED 2" lines are two rows (maybe two wardrobes): all 5 added
 if jsonb_array_length(j->'added')<>5 or jsonb_array_length(j->'skipped')<>0 then raise exception 'FAIL insert %',j; end if;
 select * into r from project_seq where id='Q1';
 if r.floor<>'T09' or r.name<>'HOUSE TYPE B' or r.pos<>1 or r.state<>'waiting' or r.line_key<>'T-9|12|K8|HOUSE TYPE B' or r.house_key<>'T-9|12' or r.created_by<>'John Burke' then raise exception 'FAIL row %',row_to_json(r); end if;
 select pos into n from project_seq where id='Q4'; if n<>4 then raise exception 'FAIL pos Q4 %',n; end if;
 select pos into n from project_seq where id='Q5'; if n<>5 then raise exception 'FAIL pos Q5 %',n; end if;
 -- the same five-line file loaded again: 0 added, 5 skipped; the second BED 2 line points at the second BED 2 row
 j := seq_insert('QP1', '[{"id":"Q21","floor":"T09","unit":"12","product":"K8","name":"HOUSE TYPE B","line_no":2},
   {"id":"Q22","floor":"T09","unit":"12","product":"K2","name":"HOUSE TYPE B UTILITY","line_no":3},
   {"id":"Q23","floor":"T09","unit":"13","product":"K8","name":"HOUSE TYPE C","line_no":4},
   {"id":"Q24","floor":"T09","unit":"13","product":"W2","name":"BED 2","line_no":5},
   {"id":"Q25","floor":"T09","unit":"13","product":"W2","name":"bed 2 ","line_no":6}]'::jsonb, null, 'John Burke');
 if jsonb_array_length(j->'added')<>0 or jsonb_array_length(j->'skipped')<>5 then raise exception 'FAIL reload %',j; end if;
 if j->'skipped'->3->>'existing_id'<>'Q4' or j->'skipped'->4->>'existing_id'<>'Q5' or j->'skipped'->4->>'line_no'<>'6'
    or j->'skipped'->4->>'why'<>'already in the sequence' then raise exception 'FAIL reload skip entries %',j->'skipped'; end if;
 -- a file with THREE identical BED 2 lines adds one more (the third), skips two
 j := seq_insert('QP1', '[{"id":"Q31","floor":"T09","unit":"13","product":"W2","name":"BED 2","line_no":1},
   {"id":"Q32","floor":"T09","unit":"13","product":"W2","name":"BED 2","line_no":2},
   {"id":"Q33","floor":"T09","unit":"13","product":"W2","name":"BED 2","line_no":3}]'::jsonb, null, 'John Burke');
 if j->'added'<>'["Q33"]'::jsonb or jsonb_array_length(j->'skipped')<>2 then raise exception 'FAIL three lines %',j; end if;
 select count(*) into n from project_seq where project_id='QP1' and line_key='T-9|13|W2|BED 2' and state<>'removed'; if n<>3 then raise exception 'FAIL three rows %',n; end if;
 -- take the extra two out again (marked removed, never deleted) so the rest of this check runs on Q1..Q4
 j := seq_remove('Q33',null,'John Burke','test'); if not (j->>'ok')::boolean then raise exception 'FAIL remove Q33 %',j; end if;
 j := seq_remove('Q5',null,'John Burke','test'); if not (j->>'ok')::boolean then raise exception 'FAIL remove Q5 %',j; end if;
 select string_agg(id,',' order by pos) into o from project_seq where project_id='QP1' and state<>'removed';
 if o<>'Q1,Q2,Q3,Q4' then raise exception 'FAIL after removing extras %',o; end if;
 -- the same file again: nothing added, every line skipped (Garry: never add the same work twice)
 j := seq_insert('QP1', '[{"id":"Q11","floor":"T09","unit":"12","product":"K8","name":"house type b","line_no":2},
   {"id":"Q12","floor":"t09","unit":"12 ","product":"K2","name":"HOUSE TYPE B UTILITY","line_no":3}]'::jsonb, null, 'John Burke');
 if jsonb_array_length(j->'added')<>0 or jsonb_array_length(j->'skipped')<>2 or j->'skipped'->0->>'existing_id'<>'Q1' then raise exception 'FAIL dup %',j; end if;
 -- insert under a chosen row
 j := seq_insert('QP1','[{"id":"Q6","floor":"T09","unit":"14","product":"K8","name":"HOUSE TYPE A","line_no":7}]'::jsonb,'Q1','John Burke');
 select string_agg(id,',' order by pos) into o from project_seq where project_id='QP1' and state<>'removed';
 if o<>'Q1,Q6,Q2,Q3,Q4' then raise exception 'FAIL insert after %',o; end if;

 -- the order only changes through seq_move
 begin update project_seq set pos=9 where id='Q1'; raise exception 'FAIL direct pos change';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin update project_seq set wo='WO-1' where id='Q1'; raise exception 'FAIL direct wo';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin update project_seq set state='removed' where id='Q1'; raise exception 'FAIL direct remove';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 -- move a whole house (Q3,Q4) to the top; stale versions refused
 j := seq_move(array['Q3','Q4'], null, array[1,99], null, 'John Burke', 'site order');
 if (j->>'ok')::boolean then raise exception 'FAIL stale move accepted'; end if;
 j := seq_move(array['Q3','Q4'], null, (select array[(select version from project_seq where id='Q3'),(select version from project_seq where id='Q4')]), null, 'John Burke', 'site order');
 if not (j->>'ok')::boolean then raise exception 'FAIL move %',j; end if;
 select string_agg(id,',' order by pos) into o from project_seq where project_id='QP1' and state<>'removed';
 if o<>'Q3,Q4,Q1,Q6,Q2' then raise exception 'FAIL order %',o; end if;
 select count(*) into n from project_events where entity='seq' and act='move' and entity_id in('Q3','Q4') and by='John Burke' and new->>'why'='site order';
 if n<>2 then raise exception 'FAIL move log %',n; end if;
 -- move under a row; anchor inside the moved block refused
 -- a stale ANCHOR (the row it goes under changed since the screen read it) is refused, nothing moves (Tester round 1)
 j := seq_move(array['Q3'], 'Q2', null, (select version from project_seq where id='Q2')-1, 'John Burke', null);
 if (j->>'ok')::boolean or j->>'err'<>'stale' then raise exception 'FAIL stale anchor accepted %',j; end if;
 select string_agg(id,',' order by pos) into o from project_seq where project_id='QP1' and state<>'removed';
 if o<>'Q3,Q4,Q1,Q6,Q2' then raise exception 'FAIL stale anchor moved %',o; end if;
 j := seq_move(array['Q3'], 'Q2', null, (select version from project_seq where id='Q2'), 'John Burke', null);
 if not (j->>'ok')::boolean then raise exception 'FAIL fresh anchor refused %',j; end if;
 select string_agg(id,',' order by pos) into o from project_seq where project_id='QP1' and state<>'removed';
 if o<>'Q4,Q1,Q6,Q2,Q3' then raise exception 'FAIL move after %',o; end if;
 j := seq_move(array['Q3'], 'Q3', null, null, 'x', null); if (j->>'ok')::boolean then raise exception 'FAIL self anchor'; end if;
 -- a row from another project can't be dragged in
 perform seq_insert('QP2','[{"id":"QX","floor":"A1","unit":"4","product":"K8","name":"TYPE A"}]'::jsonb,null,'Mary');
 j := seq_move(array['Q1','QX'], null, null, null, 'x', null); if (j->>'ok')::boolean then raise exception 'FAIL cross-project move'; end if;
 select pos into n from project_seq where id='QX'; if n<>1 then raise exception 'FAIL other project pos %',n; end if;

 -- dates on waiting rows are history
 update project_seq set req_date='2026-12-03', why='Site programme', updated_by='John Burke' where id='Q2';
 select count(*) into n from project_events where entity='seq' and entity_id='Q2' and act='date' and new->>'why'='Site programme'; if n<>1 then raise exception 'FAIL date log'; end if;

 -- matching: confident match takes the row over, keeps position and date
 select pos into n from project_seq where id='Q2';
 j := seq_match('Q2','wo-2604-8 ',(select version from project_seq where id='Q2'),'auto','Import');
 select * into r from project_seq where id='Q2';
 if not (j->>'ok')::boolean or r.wo<>'WO-2604-8' or r.state<>'matched' or r.pos<>n or r.req_date<>'2026-12-03' or r.match_how<>'auto' then raise exception 'FAIL match % %',j,row_to_json(r); end if;
 -- the same WO can't land on a second row; a matched row can't be matched again
 j := seq_match('Q1','WO-2604-8',null,'auto','Import'); if (j->>'ok')::boolean or j->>'existing_id'<>'Q2' then raise exception 'FAIL double WO %',j; end if;
 j := seq_match('Q2','WO-9',null,'auto','Import'); if (j->>'ok')::boolean then raise exception 'FAIL rematch'; end if;
 -- new WO from an import (no upload line) lands at the bottom flagged new; its WO is unique across projects
 j := seq_insert('QP1','[{"id":"Q7","wo":"WO-2611-1","src":"import","is_new":true}]'::jsonb,null,'Import');
 select * into r from project_seq where id='Q7'; if r.state<>'matched' or not r.is_new or r.pos<>6 or r.match_how<>'import' then raise exception 'FAIL new WO %',row_to_json(r); end if;
 j := seq_insert('QP2','[{"id":"Q8","wo":"WO-2611-1","src":"import"}]'::jsonb,null,'Import');
 if jsonb_array_length(j->'added')<>0 then raise exception 'FAIL WO in two projects'; end if;
 -- placing a new row clears "new"
 j := seq_move(array['Q7'],'Q4',null,null,'John Burke','placed');
 select is_new into r from project_seq where id='Q7'; if r.is_new then raise exception 'FAIL is_new kept'; end if;
 -- unmatch needs a reason; remove keeps the row and renumbers; restore goes to the bottom
 j := seq_unmatch('Q2',null,'Mary',' '); if (j->>'ok')::boolean then raise exception 'FAIL unmatch without reason'; end if;
 j := seq_unmatch('Q2',null,'Mary','wrong house'); select * into r from project_seq where id='Q2'; if r.state<>'waiting' or r.wo is not null then raise exception 'FAIL unmatch'; end if;
 j := seq_remove('Q6',null,'Mary','cancelled');
 select string_agg(id||':'||pos,',' order by pos) into o from project_seq where project_id='QP1' and state<>'removed';
 if o<>'Q4:1,Q7:2,Q1:3,Q2:4,Q3:5' then raise exception 'FAIL after remove %',o; end if;
 select count(*) into n from project_seq where id='Q6'; if n<>1 then raise exception 'FAIL removed row deleted'; end if;
 -- a removed line can be uploaded again (it is no longer counted); the old one can then still be restored too
 -- (Garry 10 Nov: the same line may be there twice) — it goes to the bottom
 j := seq_insert('QP1','[{"id":"Q6b","floor":"T09","unit":"14","product":"K8","name":"HOUSE TYPE A"}]'::jsonb,null,'John Burke');
 if jsonb_array_length(j->'added')<>1 then raise exception 'FAIL re-add after remove %',j; end if;
 j := seq_restore('Q6',null,'Mary'); if not (j->>'ok')::boolean or (j->>'pos')::int<>7 then raise exception 'FAIL restore of a line that is there again %',j; end if;
 select string_agg(id||':'||pos,',' order by pos) into o from project_seq where project_id='QP1' and state<>'removed';
 if o<>'Q4:1,Q7:2,Q1:3,Q2:4,Q3:5,Q6b:6,Q6:7' then raise exception 'FAIL after restore %',o; end if;

 -- change requests: reason needed; one open request per row; decide once
 begin insert into seq_requests(id,project_id,kind,seq_ids,change,why,asked_by) values('R0','QP1','date','{Q1}','{}',' ','John Burke');
   raise exception 'FAIL request without reason'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 insert into seq_requests(id,project_id,kind,seq_ids,wos,change,why,asked_by) values('R1','QP1','date','{Q1,Q2}','{WO-1}','{"to":"2026-11-18"}','Site ready early','John Burke');
 begin insert into seq_requests(id,project_id,kind,seq_ids,change,why,asked_by) values('R2','QP1','date','{Q2}','{}','again','John Burke');
   raise exception 'FAIL second open request'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin insert into seq_requests(id,project_id,kind,seq_ids,change,why,asked_by,status) values('R3','QP1','date','{Q3}','{}','x','John Burke','approved');
   raise exception 'FAIL insert approved'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin update seq_requests set status='refused', decided_by='Prod' where id='R1'; raise exception 'FAIL refuse without answer';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin update seq_requests set why='changed my mind' where id='R1'; raise exception 'FAIL request rewritten';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 -- approve (claim) once; a second approver is refused; applied written once
 update seq_requests set status='approved', decided_by='Prod A' where id='R1' and status='open';
 get diagnostics n = row_count; if n<>1 then raise exception 'FAIL claim'; end if;
 update seq_requests set status='approved', decided_by='Prod B' where id='R1' and status='open';
 get diagnostics n = row_count; if n<>0 then raise exception 'FAIL second claim'; end if;
 begin update seq_requests set status='refused', decided_by='Prod B', answer='no' where id='R1'; raise exception 'FAIL decision changed';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 update seq_requests set applied='{"moved":2}' where id='R1';
 update seq_requests set applied='{"moved":9}' where id='R1';
 select * into r from seq_requests where id='R1';
 if r.applied->>'moved'<>'2' or r.applied_at is null or r.decided_at is null or r.decided_by<>'Prod A' then raise exception 'FAIL applied %',row_to_json(r); end if;
 -- after a decision the rows are free for a new request; a direct change is recorded as decided by the asker
 insert into seq_requests(id,project_id,kind,seq_ids,change,why,asked_by) values('R4','QP1','move','{Q2}','{"after":null}','swap','John Burke');
 update seq_requests set status='refused', decided_by='Prod A', answer='Factory full that week' where id='R4';
 update seq_requests set seen_at=now() where id='R4';
 insert into seq_requests(id,project_id,kind,seq_ids,change,why,asked_by,status) values('R5','QP1','date','{Q2}','{}','Customer delay','Office','direct');
 select * into r from seq_requests where id='R5'; if r.decided_by<>'Office' or r.decided_at is null then raise exception 'FAIL direct %',row_to_json(r); end if;
 select count(*) into n from project_events where entity='req'; if n<>6 then raise exception 'FAIL req log count %',n; end if;

 -- Johnny's tick: stamped by the database; a sheet read never clears a hand tick
 insert into seq_pre(seq_id,wo,processed,updated_by) values('Q7','WO-2611-1',true,'Johnny');
 select * into r from seq_pre where seq_id='Q7'; if r.processed_by<>'Johnny' or r.processed_at is null or r.processed_src<>'tick' then raise exception 'FAIL tick %',row_to_json(r); end if;
 update seq_pre set processed=false, processed_src='sheet', updated_by='Sheet' where seq_id='Q7';
 select * into r from seq_pre where seq_id='Q7'; if not r.processed then raise exception 'FAIL sheet cleared hand tick'; end if;
 update seq_pre set processed=false, updated_by='Johnny' where seq_id='Q7';
 select * into r from seq_pre where seq_id='Q7'; if r.processed or r.processed_at is not null then raise exception 'FAIL untick'; end if;
 update seq_pre set pre_key=1.5 where seq_id='Q7';
 select count(*) into n from project_events where entity='pre' and entity_id='Q7'; if n<>2 then raise exception 'FAIL pre log %',n; end if;
 -- restore is still refused when the row's WO is on another live row
 j := seq_remove('Q7',null,'Mary','wrong project'); if not (j->>'ok')::boolean then raise exception 'FAIL remove Q7 %',j; end if;
 j := seq_insert('QP1','[{"id":"Q7b","wo":"WO-2611-1","src":"import"}]'::jsonb,null,'Import');
 if jsonb_array_length(j->'added')<>1 then raise exception 'FAIL WO free again after remove %',j; end if;
 j := seq_restore('Q7',null,'Mary'); if (j->>'ok')::boolean or j->>'err'<>'WO already in a sequence' then raise exception 'FAIL restore over a live WO %',j; end if;

 -- (Job B part 3) the house key is stored on every row; the claim rule in seq_insert
 select house_key into o from project_seq where id='Q3'; if o<>'T-9|13' then raise exception 'FAIL house_key %',o; end if;
 select house_key into o from project_seq where id='Q7b'; if o is not null then raise exception 'FAIL house_key of a row with no floor/unit %',o; end if;
 insert into projects(id,name) values('QP3','Q Claim') on conflict do nothing;
 -- "Start the sequence" rows: a WO, floor + unit, no product / name (no line key)
 j := seq_insert('QP3','[{"id":"QC1","wo":"QWO-1","floor":"T09","unit":"12","descr":"HOUSE TYPE B","kind":"kitchen","src":"start","match_how":"start"},
   {"id":"QC2","wo":"QWO-2","floor":"G","unit":"5","descr":"HOUSE TYPE A","kind":"kitchen","src":"start","match_how":"start"},
   {"id":"QC3","wo":"QWO-3","floor":"T09","unit":"12","descr":"HOUSE TYPE B KITCHEN 2","kind":"kitchen","src":"start","match_how":"start"}]'::jsonb,null,'John Burke');
 if jsonb_array_length(j->'added')<>3 then raise exception 'FAIL start rows (two kitchens in one house both kept) %',j; end if;
 select line_key, house_key into r from project_seq where id='QC1'; if r.line_key is not null or r.house_key<>'T-9|12' then raise exception 'FAIL start row keys %',row_to_json(r); end if;
 -- the upload: the T09/12 kitchen line is the Start row's work (typed "Block T9" / "Apt 012") → skipped; the utility is new;
 -- a second kitchen line in that house claims the second Start row; a third has none left → added; "0"/5 is not "G"/5 → added
 j := seq_insert('QP3','[{"id":"QU1","floor":"Block T9","unit":"Apt 012","product":"K8","name":"HOUSE TYPE B","kind":"kitchen","line_no":1},
   {"id":"QU2","floor":"T09","unit":"12","product":"K2","name":"HOUSE TYPE B UTILITY","kind":"utility","line_no":2},
   {"id":"QU3","floor":"T09","unit":"12","product":"K9","name":"HOUSE TYPE B ISLAND","kind":"kitchen","line_no":3},
   {"id":"QU4","floor":"T09","unit":"12","product":"K7","name":"HOUSE TYPE B EXTRA","kind":"kitchen","line_no":4},
   {"id":"QU5","floor":"0","unit":"5","product":"K1","name":"HOUSE TYPE A","kind":"kitchen","line_no":5},
   {"id":"QU6","floor":"T09","unit":"12","product":"W2","name":"BED 2","kind":"robes","line_no":6},
   {"id":"QU7","floor":"T09","unit":"12","product":"W2","name":"BED 2","kind":"robes","line_no":7}]'::jsonb,null,'John Burke');
 if j->'added'<>'["QU2","QU4","QU5","QU6","QU7"]'::jsonb then raise exception 'FAIL claim added %',j; end if;
 if j->'skipped'->0->>'existing_id'<>'QC1' or j->'skipped'->0->>'by'<>'house' or j->'skipped'->1->>'existing_id'<>'QC3' or jsonb_array_length(j->'skipped')<>2
   then raise exception 'FAIL claim skipped %',j->'skipped'; end if;
 -- the same file again: 0 added (the line rows claim by line key first, the Start rows by house)
 j := seq_insert('QP3','[{"id":"QV1","floor":"T09","unit":"12","product":"K8","name":"HOUSE TYPE B","kind":"kitchen","line_no":1},
   {"id":"QV2","floor":"T09","unit":"12","product":"K2","name":"HOUSE TYPE B UTILITY","kind":"utility","line_no":2},
   {"id":"QV3","floor":"T09","unit":"12","product":"K9","name":"HOUSE TYPE B ISLAND","kind":"kitchen","line_no":3},
   {"id":"QV4","floor":"T09","unit":"12","product":"K7","name":"HOUSE TYPE B EXTRA","kind":"kitchen","line_no":4},
   {"id":"QV5","floor":"0","unit":"5","product":"K1","name":"HOUSE TYPE A","kind":"kitchen","line_no":5},
   {"id":"QV6","floor":"T09","unit":"12","product":"W2","name":"BED 2","kind":"robes","line_no":6},
   {"id":"QV7","floor":"T09","unit":"12","product":"W2","name":"BED 2","kind":"robes","line_no":7}]'::jsonb,null,'John Burke');
 if jsonb_array_length(j->'added')<>0 or jsonb_array_length(j->'skipped')<>7 then raise exception 'FAIL claim same file twice %',j; end if;
 select count(*) into n from project_seq where project_id='QP3' and state<>'removed'; if n<>8 then raise exception 'FAIL claim row count %',n; end if;
 -- a line WITH a WO never claims a Start row by house (it is its own work order)
 j := seq_insert('QP3','[{"id":"QW1","wo":"QWO-9","floor":"G","unit":"5","product":"K1","name":"HOUSE TYPE A","kind":"kitchen"}]'::jsonb,null,'Import');
 if j->'added'<>'["QW1"]'::jsonb then raise exception 'FAIL WO line claimed by house %',j; end if;
 -- an old key (an earlier run of the block) is put right by any write
 update project_seq set line_key='OLD', house_key='OLD', updated_by='x' where id='QU2';
 select line_key, house_key into r from project_seq where id='QU2'; if r.line_key<>'T-9|12|K2|HOUSE TYPE B UTILITY' or r.house_key<>'T-9|12' then raise exception 'FAIL keys not recomputed %',row_to_json(r); end if;

 -- nobody using the app can delete
 begin delete from project_seq where id='Q1'; raise exception 'FAIL delete seq'; exception when insufficient_privilege then null; end;
 begin delete from seq_requests where id='R1'; raise exception 'FAIL delete req'; exception when insufficient_privilege then null; end;
 begin delete from seq_pre where seq_id='Q7'; raise exception 'FAIL delete pre'; exception when insufficient_privilege then null; end;
 begin insert into project_events(project_id) values('QP1'); raise exception 'FAIL app wrote history'; exception when insufficient_privilege then null; end;
 begin perform seq_renumber('QP1','{}'); raise exception 'FAIL renumber callable'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- lists switched off: nothing can be written (the functions refuse too)
update production_planner set settings=jsonb_build_object('listStore','switching') where id='main';
update production_planner set settings=jsonb_build_object('listStore','v1') where id='main';
do $$ begin if lists_writable() then raise exception 'FAIL setup: lists still on'; end if; end $$;
set role anon;
do $$ declare j jsonb; n int; begin
 -- every one of the six functions refuses (Manager condition 4)
 begin j := seq_move(array['Q1'], null, null, null, 'x', null); raise exception 'FAIL move while switched off';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin j := seq_insert('QP1','[{"id":"QZ1","floor":"Z","unit":"1","product":"K1","name":"Z"}]'::jsonb,null,'x'); raise exception 'FAIL seq_insert while switched off';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin j := seq_match('Q2','WO-OFF-1',null,'confirmed','x'); raise exception 'FAIL seq_match while switched off';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin j := seq_unmatch('Q4',null,'x','off'); raise exception 'FAIL seq_unmatch while switched off';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin j := seq_remove('Q1',null,'x','off'); raise exception 'FAIL seq_remove while switched off';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 begin j := seq_restore('Q5',null,'x','off'); raise exception 'FAIL seq_restore while switched off';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 -- direct inserts are refused by row-level security; direct updates change no row
 begin insert into project_seq(id,project_id,name) values('QZ','QP1','Z'); raise exception 'FAIL insert while switched off';
 exception when insufficient_privilege then null; end;
 begin insert into seq_requests(id,project_id,kind,seq_ids,change,why,asked_by) values('RZ','QP1','date','{Q3}','{}','off','x'); raise exception 'FAIL request insert while switched off';
 exception when insufficient_privilege then null; end;
 begin insert into seq_pre(seq_id,wo,processed,updated_by) values('Q3',null,true,'x'); raise exception 'FAIL seq_pre insert while switched off';
 exception when insufficient_privilege then null; end;
 update project_seq set req_date='2027-01-01', updated_by='x' where id='Q3'; get diagnostics n = row_count; if n<>0 then raise exception 'FAIL seq update while switched off'; end if;
 update seq_requests set seen_at=now() where id='R4'; get diagnostics n = row_count; if n<>0 then raise exception 'FAIL request update while switched off'; end if;
 update seq_pre set pre_key=9 where seq_id='Q7'; get diagnostics n = row_count; if n<>0 then raise exception 'FAIL seq_pre update while switched off'; end if;
end $$;
reset role;
do $$ begin
 if exists(select 1 from project_seq where id in('QZ','QZ1')) or (select req_date from project_seq where id='Q3') is not distinct from '2027-01-01'::date
    or (select pre_key from seq_pre where seq_id='Q7')=9 or exists(select 1 from seq_requests where id='RZ') or exists(select 1 from seq_pre where seq_id='Q3')
    or (select state from project_seq where id='Q1')='removed' or (select state from project_seq where id='Q5')<>'removed' then
   raise exception 'FAIL something was written while switched off'; end if;
end $$;
reset role;
select 'ALL SEQ PG CHECKS PASSED' as result;
