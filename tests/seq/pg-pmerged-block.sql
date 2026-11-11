-- ===================== MERGED P-NUMBERS STAY MERGED (L4b, attack9 M4) =====================
-- A save may not bring back a P-number that the planner record lists as merged (settings.pMerged[].wo) and that is no longer a job.
create or replace function pp_pmerged_guard() returns trigger language plpgsql as $$
declare back text;
begin
  if new.orders is null then return new; end if;
  select string_agg(distinct n->>'wo', ', ') into back
    from jsonb_array_elements(case when jsonb_typeof(new.orders::jsonb)='array' then new.orders::jsonb else '[]'::jsonb end) n
   where n->>'wo' ~ '^P-[0-9]+$'
     and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(coalesce(old.settings::jsonb->'pMerged','[]'::jsonb))='array'
                  then old.settings::jsonb->'pMerged' else '[]'::jsonb end) t where t->>'wo' = n->>'wo')
     and not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(old.orders::jsonb)='array' then old.orders::jsonb else '[]'::jsonb end) o
                  where o->>'wo' = n->>'wo');
  if back is not null then
    raise exception '% was merged into its Cienapps work order — this screen is out of date. Refresh the page.', back;
  end if;
  return new;
end $$;
drop trigger if exists pp_pmerged_guard on production_planner;
create trigger pp_pmerged_guard before update on production_planner for each row execute function pp_pmerged_guard();
