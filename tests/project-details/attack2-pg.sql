-- Tester attack 2 (Project details, several specs per project — 11 Nov) on a THROWAWAY Postgres copy only. Never live.
-- createdb -h /tmp/pgwpf -p 5499 -U postgres -T f2 atk2pg ; psql -h /tmp/pgwpf -p 5499 -U postgres -d atk2pg -f tests/project-details/attack2-pg.sql ; dropdb … atk2pg
-- Every line prints "OK …" (the rule held) or "FINDING …" (the database lets it through). No ON_ERROR_STOP: each check runs on its own.
update production_planner set settings=jsonb_build_object('listStore','migrating') where id='main' and coalesce(settings->>'listStore','v1')='v1';
update production_planner set settings=jsonb_build_object('listStore','v2') where id='main' and settings->>'listStore'='migrating';
insert into projects(id,name) values('XA','Proj A'),('XB','Proj B') on conflict do nothing;
insert into project_materials(id,project_id,name,kind) values('XMA','XA','MFC A','sheet'),('XMB','XB','MFC B (other project)','sheet') on conflict do nothing;
set role anon;
insert into project_specs(id,project_id,name,spec_type,updated_by) values('XSA','XA','Kitchens','kitchens','T'),('XSA2','XA','Robes','robes','T'),('XSB','XB','Kitchens','kitchens','T');

-- 1. an item sent with project A but spec of project B: the project is taken from the spec (lands on B, not A)
insert into project_spec_items(id,project_id,spec_id,item,value,updated_by) values('XI1','XA','XSB','Hinges','Blum','T');
select case when project_id='XB' then 'OK 1 item takes the project of its spec' else 'FINDING 1 item kept project '||project_id||' with a spec of XB' end from project_spec_items where id='XI1';
-- 2. moving an item to another spec by PATCH (spec_id / project_id) is ignored
update project_spec_items set spec_id='XSA', project_id='XA' where id='XI1';
select case when spec_id='XSB' and project_id='XB' then 'OK 2 item cannot move spec / project' else 'FINDING 2 item moved to '||spec_id||'/'||project_id end from project_spec_items where id='XI1';
-- 3. a spec item on project A pointing at project B's material
do $$ begin
  insert into project_spec_items(id,project_id,spec_id,item,value,material_id,updated_by) values('XI3','XA','XSA','Carcass Material','MFC B (other project)','XMB','T');
  raise notice 'FINDING 3 a spec item on project A links to project B''s material (FK only, no same-project check)';
exception when others then raise notice 'OK 3 cross-project material refused: %', sqlerrm; end $$;
-- 4. every spec of a project retired (two PCs each retiring "the other one") — nothing in the database stops it
-- (round 3: pspec_rules now keeps one spec in use.) 4a one at a time; 4b BOTH in ONE statement (what a PATCH ?project_id=eq.XA does)
do $$ begin update project_specs set active=false where id='XSA2'; update project_specs set active=false where id='XSA'; raise notice 'FINDING 4a last spec retired';
exception when raise_exception then raise notice 'OK 4a the last spec in use can''t be retired: %', sqlerrm; end $$;
update project_specs set active=true where project_id='XA';
do $$ begin update project_specs set active=false where project_id='XA';
  if not exists(select 1 from project_specs where project_id='XA' and active) then raise notice 'FINDING 4b one UPDATE retiring every spec of a project at once is accepted (each row''s check misses the other rows of the same statement)'; else raise notice 'OK 4b'; end if;
exception when raise_exception then raise notice 'OK 4b one statement retiring every spec refused: %', sqlerrm; end $$;
update project_specs set active=true where id='XSA'; update project_specs set active=false where id='XSA2';
-- 5. an item added / signed off on a RETIRED spec
do $$ begin
  insert into project_spec_items(id,project_id,spec_id,item,value,status,signed_by,updated_by) values('XI5','XA','XSA2','Handles','Bar','signed-off','Someone','T');
  raise notice 'FINDING 5 an item can be added (and signed off) on a retired spec';
exception when others then raise notice 'OK 5 refused: %', sqlerrm; end $$;
-- 6. sign-off straight to the database by anyone with the page (PINs are screen-level only) — any name accepted
update project_spec_items set status='signed-off', signed_by='Not A PM', updated_by='office PC' where id='XI1';
select case when status='signed-off' and signed_by='Not A PM' then 'INFO 6 anyone can sign off directly against the database, under any name' else 'OK 6' end from project_spec_items where id='XI1';
-- 7. the retired spec's name can never be used again (unique index includes retired specs)
do $$ begin insert into project_specs(id,project_id,name) values('XSA3','XA','robes'); raise notice 'OK 7 name of a retired spec reusable';
exception when unique_violation then raise notice 'INFO 7 the name of a retired spec can never be reused (only bringing it back)'; end $$;
-- 8. bring a retired spec back (the app has no button for it — can the database?)
update project_specs set active=true where id='XSA2';
select case when active then 'OK 8 a retired spec can be brought back (the Bring back button)' else 'FINDING 8' end from project_specs where id='XSA2';
-- 9. the spec id itself changed (PK update) — orphaning / moving the items?
do $$ begin update project_specs set id='XSA2-NEW' where id='XSA2'; raise notice 'INFO 9 a spec with no items yet can have its id changed by a raw call (items: %) — no screen does it', (select count(*) from project_spec_items where spec_id='XSA2');
exception when others then raise notice 'OK 9 spec id change refused: %', sqlerrm; end $$;
-- 10. a spec name that is only an invisible character (zero-width space) / NBSP
do $$ begin insert into project_specs(id,project_id,name) values('XS10','XA',E'​'); raise notice 'FINDING 10 a spec called only a zero-width space is accepted (looks blank)';
exception when others then raise notice 'OK 10 refused: %', sqlerrm; end $$;
do $$ begin insert into project_specs(id,project_id,name) values('XS11','XA',E'  '); raise notice 'FINDING 11 a spec called only no-break spaces is accepted';
exception when others then raise notice 'OK 11 NBSP-only name refused: %', sqlerrm; end $$;
-- 12. spec type changed after items were filled in (kitchens → robes): the items stay, the checklist changes under them
update project_specs set spec_type='robes' where id='XSB';
select case when spec_type='robes' then 'INFO 12 spec_type can be changed after items exist (no screen offers it; kitchen-only items would show as extras)' else 'OK 12' end from project_specs where id='XSB';
-- 13. two names that differ only in inner spacing / case / full-width letters
do $$ begin insert into project_specs(id,project_id,name) values('XS13','XB',E'ＫＩＴＣＨＥＮＳ'); raise notice 'FINDING 13 full-width duplicate name accepted';
exception when unique_violation then raise notice 'OK 13 full-width duplicate refused'; end $$;
reset role;
-- 14. lists switched off: no spec writes
update production_planner set settings=jsonb_build_object('listStore','switching') where id='main';
update production_planner set settings=jsonb_build_object('listStore','v1') where id='main';
select 'store now: '||coalesce(settings->>'listStore','?') from production_planner where id='main';
set role anon;
do $$ declare n int; begin insert into project_specs(id,project_id,name) values('XS14','XB','After switch-off'); get diagnostics n=row_count; raise notice 'FINDING 14 spec added with the lists switched off (% row)', n;
exception when others then raise notice 'OK 14 refused after switch-off: %', sqlerrm; end $$;
reset role;
