-- Stores dockets: the SQL in SUPABASE_CHANGES.md ("Stores dockets" block) checked on a THROWAWAY local Postgres set up
-- like Supabase (roles anon / authenticated / service_role; Stage 1 + Stage 3 + Stores dockets blocks run first, twice).
-- Never run this against the live project. Run: psql -v ON_ERROR_STOP=1 -d <throwaway db> -f tests/stores-docket/pg-check.sql
-- Every check raises an error (and stops) if it fails; the last line prints ALL PG CHECKS PASSED.
-- the keep-switch trigger only lets the switch move the way Migrate / Switch back move it
update production_planner set settings=jsonb_build_object('listStore','migrating') where id='main' and coalesce(settings->>'listStore','v1')='v1';
update production_planner set settings=jsonb_build_object('listStore','v2') where id='main' and settings->>'listStore'='migrating';
insert into projects(id,name,customer,site_address) values('PG1','PG Aderrig','Aderrig Homes','Site 1, Lucan') on conflict do nothing;
insert into projects(id,name) values('PG2','PG Other') on conflict do nothing;
insert into lists(id,project_id,name,wos) values('PGL1','PG1','House 1','{WO-1}'),('PGL2','PG2','Other house','{WO-9}'),
  ('PGL3','PG1','Old house','{WO-2}') on conflict do nothing;
update lists set archived=true where id='PGL3';
insert into list_lines(id,list_id,seq,kind,part,qty,material,status) values
 ('PGL1:1','PGL1',1,'fit','Tap','20','Chrome','todo'),
 ('PGL1:2','PGL1',2,'fit','Hinge','8','Blum','waiting'),
 ('PGL1:3','PGL1',3,'buy','Worktop','1','Oak','todo'),
 ('PGL1:4','PGL1',4,'saw','Side','2','MFC','todo'),
 ('PGL1:5','PGL1',5,'fit','Handle','2x2',null,'todo'),
 ('PGL1:6','PGL1',6,'fit','Bin','1',null,'na'),
 ('PGL2:1','PGL2',1,'fit','Tap','4',null,'todo'),
 ('PGL3:1','PGL3',1,'fit','Tap','4',null,'todo') on conflict do nothing;

set role anon;
do $$ declare r jsonb; n int; begin
 -- the app can't write the docket tables directly
 begin insert into stores_dockets(id,docket_no,yr,seq,project_name,made_by) values('X','X',1,1,'X','X'); raise exception 'FAIL direct insert allowed';
 exception when insufficient_privilege then null; end;
 begin delete from stores_dockets; raise exception 'FAIL delete allowed'; exception when insufficient_privilege then null; end;
 begin update stores_docket_items set active=false; raise exception 'FAIL direct update allowed'; exception when insufficient_privilege then null; end;
 -- part quantity: 10 of 20
 r:=make_docket('{"project_id":"PG1","site_address":"Site 1","cid":"pg-a"}','[{"line_id":"PGL1:1","qty":"10","wo":"WO-1","floor":"GF","unit":"1"}]','Stores');
 if not (r->>'ok')::boolean or r->>'docket_no' not like 'D__-0001' then raise exception 'FAIL first docket %',r; end if;
 if (select status from list_lines where id='PGL1:1')<>'todo' then raise exception 'FAIL 10 of 20 must not be got out'; end if;
 -- the same tap resent (lost reply): the same docket
 r:=make_docket('{"project_id":"PG1","cid":"pg-a"}','[{"line_id":"PGL1:1","qty":"10"}]','Stores');
 if not (r->>'dup')::boolean or r->>'docket_no' not like 'D__-0001' then raise exception 'FAIL resend %',r; end if;
 -- 11 more refused (only 10 left), nothing written
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:1","qty":"11"},{"item":"Spare handles","qty":"2"}]','Stores');
 if (r->>'ok')::boolean or r->'refused'->0->>'why'<>'too-many' or (r->'refused'->0->>'left')::numeric<>10 then raise exception 'FAIL 11 of 10 left %',r; end if;
 if (select count(*) from stores_dockets)<>1 then raise exception 'FAIL a refused docket wrote something'; end if;
 -- 10 more: OK, line now got out, number 0002
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:1","qty":"10"},{"item":"Spare handles","qty":"2","wo":"WO-1"}]','Stores');
 if not (r->>'ok')::boolean or r->>'docket_no' not like 'D__-0002' then raise exception 'FAIL second docket %',r; end if;
 if (select status from list_lines where id='PGL1:1')<>'got-out' then raise exception 'FAIL fully sent line must be got out'; end if;
 if not exists(select 1 from list_events where line_id='PGL1:1' and act='docket' and note like 'D__-0002 · 10 of 20') then raise exception 'FAIL event'; end if;
 if not (select locked from lists where id='PGL1') then raise exception 'FAIL list locked'; end if;
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:1","qty":"1"}]','Stores');
 if r->'refused'->0->>'why'<>'got-out' then raise exception 'FAIL got-out line refused %',r; end if;
 -- refusals
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:2","qty":"1"}]','S'); if r->'refused'->0->>'why'<>'waiting' then raise exception 'FAIL waiting %',r; end if;
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:4","qty":"1"}]','S'); if r->'refused'->0->>'why'<>'wrong-kind' then raise exception 'FAIL saw line %',r; end if;
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:6","qty":"1"}]','S'); if r->'refused'->0->>'why'<>'not-needed' then raise exception 'FAIL na %',r; end if;
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL2:1","qty":"1"}]','S'); if r->'refused'->0->>'why'<>'other-project' then raise exception 'FAIL other project %',r; end if;
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL3:1","qty":"1"}]','S'); if r->'refused'->0->>'why'<>'not-live' then raise exception 'FAIL archived %',r; end if;
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:3","qty":"0"}]','S'); if r->'refused'->0->>'why'<>'bad-qty' then raise exception 'FAIL qty 0 %',r; end if;
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"nope","qty":"1"}]','S'); if r->'refused'->0->>'why'<>'missing' then raise exception 'FAIL missing %',r; end if;
 begin r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:3","qty":"1"},{"line_id":"PGL1:3","qty":"1"}]','S'); raise exception 'FAIL twice';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 -- bought-in line: whole qty, keeps its status; a "2x2" line goes whole
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:3","qty":"1"},{"line_id":"PGL1:5","qty":"1"}]','S');
 if not (r->>'ok')::boolean then raise exception 'FAIL buy + 2x2 %',r; end if;
 if (select status from list_lines where id='PGL1:3')<>'todo' or (select status from list_lines where id='PGL1:5')<>'got-out' then raise exception 'FAIL buy keeps status / 2x2 got out'; end if;
 if (select qty_text from stores_docket_items where line_id='PGL1:5')<>'2x2' then raise exception 'FAIL 2x2 text kept'; end if;
 -- release the waiting line → sendable
 perform apply_line_changes('[{"id":"PGL1:2","act":"release","cid":"pg-rel"}]','Stores');
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:2","qty":"8"}]','S'); if not (r->>'ok')::boolean then raise exception 'FAIL after release %',r; end if;
 -- cancel docket 0002: its 10 taps are free again, the line goes back to to-pick
 select id into r from (select to_jsonb(id) id from stores_dockets where docket_no like 'D__-0002') z;
 begin perform docket_cancel(r#>>'{}','','S'); raise exception 'FAIL cancel without reason'; exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
 r:=docket_cancel((select id from stores_dockets where docket_no like 'D__-0002'),'Wrong taps','Stores');
 if not (r->>'ok')::boolean then raise exception 'FAIL cancel %',r; end if;
 if (select status from list_lines where id='PGL1:1')<>'todo' then raise exception 'FAIL cancel frees the line'; end if;
 if (select status from stores_dockets where docket_no like 'D__-0002')<>'cancelled' then raise exception 'FAIL cancelled kept'; end if;
 r:=make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:1","qty":"10"}]','S'); if not (r->>'ok')::boolean then raise exception 'FAIL resend after cancel %',r; end if;
 -- delivered
 r:=docket_delivered((select id from stores_dockets where docket_no like 'D__-0001'),'Joe Site','2026-11-05','J. Site','Office');
 if not (r->>'ok')::boolean or (select received_by from stores_dockets where docket_no like 'D__-0001')<>'Joe Site' then raise exception 'FAIL delivered %',r; end if;
 r:=docket_cancel((select id from stores_dockets where docket_no like 'D__-0001'),'x','S'); if (r->>'ok')::boolean then raise exception 'FAIL cancel delivered %',r; end if;
 r:=docket_delivered((select id from stores_dockets where docket_no like 'D__-0002'),'Joe','2026-11-05',null,'S'); if (r->>'ok')::boolean then raise exception 'FAIL deliver cancelled %',r; end if;
 -- switch OFF: free-typed dockets still work, list lines refused
 reset role;
 update production_planner set settings=jsonb_build_object('listStore','switching') where id='main';
 update production_planner set settings=jsonb_build_object('listStore','v1') where id='main';
 set role anon;
 r:=make_docket('{"project_name":"Cherrywood","customer":"Cairn"}','[{"item":"Spare hinges","qty":"6","wo":"WO-5","floor":"1","unit":"12"}]','Stores');
 if not (r->>'ok')::boolean then raise exception 'FAIL free docket switch off %',r; end if;
 begin perform make_docket('{"project_id":"PG1"}','[{"line_id":"PGL1:3","qty":"1"}]','S'); raise exception 'FAIL line with switch off';
 exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; if sqlerrm not like 'switched off%' then raise exception 'FAIL wrong error %',sqlerrm; end if; end;
 raise notice 'ALL PG CHECKS PASSED';
end $$;
reset role;
