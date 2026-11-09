-- Tester attack 1 (Project details) on a THROWAWAY Postgres copy only (createdb -T base1). Never live.
-- NOTE: the last block (switch back to v1) is held at v2 by the keep-switch rule, so it proves nothing; switch-off writes are covered by the browser test.
-- Run: psql -h /tmp/pgwpf -p 5499 -U postgres -d <copy> -f tests/project-details/attack1-pg.sql
update production_planner set settings=jsonb_build_object('listStore','migrating') where id='main' and coalesce(settings->>'listStore','v1')='v1';
update production_planner set settings=jsonb_build_object('listStore','v2') where id='main' and settings->>'listStore'='migrating';
insert into projects(id,name) values('PA1','PA') on conflict do nothing;
set role anon;
insert into project_spec_items(id,project_id,item,value,status,updated_by) values
 ('A1','PA1','Hinges',E'TBC ','signed-off','Ann'),     -- TBC + no-break space (pasted from Excel/Word)
 ('A2','PA1','Handles',E'\tTBC\n','signed-off','Ann'),       -- tab / newline around TBC
 ('A3','PA1','Plinth',E' ','signed-off','Ann'),          -- only a no-break space
 ('A4','PA1',E'Cornice ','Big','proposed','Ann'),        -- item with NBSP
 ('A5','PA1','Pelmet','ＴＢＣ','signed-off','Ann');            -- full-width TBC
select id, quote_literal(value) v, status, signed_by from project_spec_items where project_id='PA1' order by id;
-- same item twice with NBSP / case
insert into project_spec_items(id,project_id,item,value,updated_by) values('A6','PA1','cornice','x','Bob');
-- anon may not delete / write history
delete from project_spec_items where id='A1';
select count(*) as still_there from project_spec_items where id='A1';
insert into project_events(project_id,entity,entity_id,act,by) values('PA1','spec','A1','edit','evil');
-- switch off → no writes
reset role;
update production_planner set settings=jsonb_build_object('listStore','v1') where id='main';
set role anon;
update project_spec_items set value='after switch-off' where id='A4';
select id, value from project_spec_items where id='A4';
