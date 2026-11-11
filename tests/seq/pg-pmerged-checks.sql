insert into production_planner values('main','[{"wo":"P-1001"},{"wo":"WO-9"}]','{}',1);
-- merge: P-1001 leaves, WO-40 arrives, pMerged remembers it — allowed
update production_planner set orders='[{"wo":"WO-40"},{"wo":"WO-9"}]', settings='{"pMerged":[{"wo":"P-1001","into":"WO-40"}]}' where id='main';
-- an ordinary save — allowed
update production_planner set orders='[{"wo":"WO-40","notes":"x"},{"wo":"WO-9"},{"wo":"P-1002"}]' where id='main';
-- an old screen brings P-1001 back — refused
do $$ begin
  begin update production_planner set orders='[{"wo":"WO-40"},{"wo":"P-1001"}]' where id='main'; raise exception 'FAIL merged P came back';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; if sqlerrm not like 'P-1001 was merged%' then raise exception 'FAIL wrong error %',sqlerrm; end if; end;
end $$;
-- even when that save leaves pMerged out of settings — refused (the rule reads the record as it was)
do $$ begin
  begin update production_planner set orders='[{"wo":"P-1001"}]', settings='{}' where id='main'; raise exception 'FAIL merged P came back (no pMerged)';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
end $$;
-- a save that leaves orders out — allowed
update production_planner set settings='{"pMerged":[{"wo":"P-1001","into":"WO-40"}],"x":1}' where id='main';
delete from production_planner;
