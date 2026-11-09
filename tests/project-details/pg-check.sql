-- Project details: the SQL in SUPABASE_CHANGES.md ("Project details" block) checked on a THROWAWAY local Postgres set up
-- like Supabase (roles anon / authenticated / service_role; Stage 1 + Stage 3 + Stores dockets + Project details blocks run
-- first, each twice). Never run this against the live project.
-- Run: psql -v ON_ERROR_STOP=1 -d <throwaway db> -f tests/project-details/pg-check.sql   → last line: ALL PG CHECKS PASSED
update production_planner set settings=jsonb_build_object('listStore','migrating') where id='main' and coalesce(settings->>'listStore','v1')='v1';
update production_planner set settings=jsonb_build_object('listStore','v2') where id='main' and settings->>'listStore'='migrating';
insert into projects(id,name) values('PS1','PS Aderrig') on conflict do nothing;
insert into project_materials(id,project_id,name,kind) values('PSM1','PS1','18mm MFC White','sheet') on conflict do nothing;
set role anon;
do $$ declare r record; n int; begin
 -- TBC / blank = not specified, whatever the screen sends
 insert into project_spec_items(id,project_id,item,value,status,updated_by) values('S1','PS1','Hinges','TBC','proposed','Ann');
 select * into r from project_spec_items where id='S1'; if r.status<>'not-specified' then raise exception 'FAIL TBC is %',r.status; end if;
 insert into project_spec_items(id,project_id,item,value,updated_by) values('S2','PS1',' Handles ','  ','Ann');
 select * into r from project_spec_items where id='S2'; if r.status<>'not-specified' or r.value is not null or r.item<>'Handles' then raise exception 'FAIL blank %',row_to_json(r); end if;
 -- TBC can never be signed off (lower case too)
 begin update project_spec_items set status='signed-off',signed_by='Ann' where id='S1';
   select * into r from project_spec_items where id='S1'; if r.status='signed-off' then raise exception 'FAIL TBC signed off'; end if;
 end;
 begin insert into project_spec_items(id,project_id,item,value,status) values('S3','PS1','Cornice','tbc','signed-off');
   select * into r from project_spec_items where id='S3'; if r.status<>'not-specified' or r.signed_by is not null then raise exception 'FAIL tbc insert signed %',row_to_json(r); end if; end;
 -- a value = proposed; sign-off records who and when
 update project_spec_items set value='Hettich Stock',updated_by='Ann' where id='S1';
 select * into r from project_spec_items where id='S1'; if r.status<>'proposed' then raise exception 'FAIL value → %',r.status; end if;
 update project_spec_items set status='signed-off',signed_by='Mary',updated_by='Mary' where id='S1';
 select * into r from project_spec_items where id='S1'; if r.status<>'signed-off' or r.signed_by<>'Mary' or r.signed_at is null then raise exception 'FAIL sign %',row_to_json(r); end if;
 -- a sign-off can't be re-named by a later save
 update project_spec_items set signed_by='Someone else',note='x' where id='S1';
 select * into r from project_spec_items where id='S1'; if r.signed_by<>'Mary' then raise exception 'FAIL re-named sign-off'; end if;
 -- changing a signed-off value (even by an old screen that keeps status=signed-off) drops it to proposed
 update project_spec_items set value='Blum',updated_by='OldTab' where id='S1';
 select * into r from project_spec_items where id='S1'; if r.status<>'proposed' or r.signed_by is not null or r.signed_at is not null then raise exception 'FAIL change kept sign %',row_to_json(r); end if;
 -- signed off → TBC = not specified
 update project_spec_items set status='signed-off',signed_by='Mary' where id='S1';
 update project_spec_items set value='TBC' where id='S1';
 select * into r from project_spec_items where id='S1'; if r.status<>'not-specified' then raise exception 'FAIL TBC after sign %',r.status; end if;
 -- one row per item per project (case and spaces ignored)
 begin insert into project_spec_items(id,project_id,item) values('S9','PS1','HINGES '); raise exception 'FAIL duplicate item allowed';
 exception when unique_violation then null; end;
 -- history written by the database; the app can't write or delete it, and can't delete spec rows
 select count(*) into n from project_events where entity_id='S1'; if n<6 then raise exception 'FAIL history rows %',n; end if;
 if not exists(select 1 from project_events where entity_id='S1' and act='sign-off' and by='Mary') then raise exception 'FAIL no sign-off event'; end if;
 if not exists(select 1 from project_events where entity_id='S1' and act='unsign' and by='OldTab' and old->>'value'='Hettich Stock' and new->>'value'='Blum') then raise exception 'FAIL no unsign event'; end if;
 begin insert into project_events(project_id,entity,act) values('PS1','spec','x'); raise exception 'FAIL app wrote history';
 exception when insufficient_privilege then null; end;
 begin delete from project_spec_items; raise exception 'FAIL delete allowed'; exception when insufficient_privilege then null; end;
 begin delete from project_events; raise exception 'FAIL history delete allowed'; exception when insufficient_privilege then null; end;
 -- version goes up on every change (screens check it)
 select version into n from project_spec_items where id='S1'; if n<5 then raise exception 'FAIL version %',n; end if;
 -- material link
 update project_spec_items set value='18mm MFC White',material_id='PSM1' where id='S2';
 -- unchanged save = no history row
 select count(*) into n from project_events where entity_id='S2';
 update project_spec_items set note=null where id='S2';
 if (select count(*) from project_events where entity_id='S2')<>n then raise exception 'FAIL history on no-change'; end if;
end $$;
reset role;
-- lists switched back to the old store: no spec writes
update production_planner set settings=jsonb_build_object('listStore','switching') where id='main';
update production_planner set settings=jsonb_build_object('listStore','v1') where id='main';
set role anon;
do $$ declare n int; begin
 begin insert into project_spec_items(id,project_id,item) values('S8','PS1','Sink Type'); raise exception 'FAIL insert while switched back';
 exception when insufficient_privilege then null; end;
 update project_spec_items set value='X' where id='S2'; get diagnostics n = row_count; if n<>0 then raise exception 'FAIL update while switched back'; end if;
end $$;
reset role;
select 'ALL PG CHECKS PASSED';
