-- Old-screen guard v2: exactly the grey box in SUPABASE_CHANGES.md (kept in step with it; pg-guard-v2.sql runs it twice).
-- Same as the 3 Nov guard (a save must ask for exactly the next version) PLUS: once the planner record has been saved by
-- the dates-and-deliveries code (settings.appRel 2 or more), a save without that marker (an older screen still open) is refused.
create or replace function production_planner_bump() returns trigger language plpgsql as $$
declare
  old_rel int := 0;
  new_rel int := 0;
  t text;
begin
  if old.id = 'main' and new.version is distinct from old.version + 1 then
    raise exception 'This planner screen is out of date - refresh the page' using errcode = 'P0001';
  end if;
  if old.id = 'main' then
    t := to_jsonb(old.settings)->>'appRel'; if t ~ '^[0-9]{1,6}$' then old_rel := t::int; end if;
    t := to_jsonb(new.settings)->>'appRel'; if t ~ '^[0-9]{1,6}$' then new_rel := t::int; end if;
    if old_rel >= 2 and new_rel < 2 then
      raise exception 'This planner screen is out of date - refresh the page' using errcode = 'P0001';
    end if;
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
