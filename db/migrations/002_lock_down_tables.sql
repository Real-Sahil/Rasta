-- Defence in depth: only the API's owner role should ever touch these tables.
-- Row-level security with no policies denies every other role (e.g. a Data API 'anon'/'authenticated' role,
-- should one ever be enabled); table owners bypass RLS, so the API keeps working.
alter table incidents              enable row level security;
alter table incident_confirmations enable row level security;
alter table incident_flags         enable row level security;

revoke all on incidents, incident_confirmations, incident_flags from public;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on incidents, incident_confirmations, incident_flags from %I', r);
    end if;
  end loop;
end $$;
