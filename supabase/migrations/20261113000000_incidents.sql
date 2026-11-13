-- Buraq Pakistan: community incident reports.
-- Design: anonymous Supabase auth (one id per device), RLS everywhere, abuse limits enforced in the database.

create table public.incidents (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category        text not null check (category in
                    ('accident','congestion','closure','construction','flooding','roadblock','police_naka','hazard')),
  title           text not null check (char_length(btrim(title)) between 3 and 120),
  title_ur        text check (title_ur is null or char_length(title_ur) <= 120),
  description     text check (description is null or char_length(description) <= 500),
  description_ur  text check (description_ur is null or char_length(description_ur) <= 500),
  location_name   text check (location_name is null or char_length(location_name) <= 160),
  advice          text check (advice is null or char_length(advice) <= 300),
  lat             double precision not null check (lat between 23.0 and 37.5),   -- Pakistan bounding box
  lng             double precision not null check (lng between 60.0 and 77.9),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '2 hours'),
  confirmations   integer not null default 0 check (confirmations >= 0),
  flags           integer not null default 0 check (flags >= 0),
  hidden          boolean not null default false
);

create index incidents_active_idx on public.incidents (expires_at) where not hidden;
create index incidents_geo_idx    on public.incidents (lat, lng);
create index incidents_owner_idx  on public.incidents (created_by, created_at desc);

create table public.incident_confirmations (
  incident_id uuid not null references public.incidents (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (incident_id, user_id)
);

create table public.incident_flags (
  incident_id uuid not null references public.incidents (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (incident_id, user_id)
);

-- ---------------------------------------------------------------- triggers
-- Clients may only supply content fields; counters, ownership and lifetime are decided here.
create function public.incidents_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.incidents
        where created_by = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate limit: at most 10 reports per hour' using errcode = 'P0001';
  end if;
  new.created_by    := auth.uid();
  new.created_at    := now();
  new.confirmations := 0;
  new.flags         := 0;
  new.hidden        := false;
  new.expires_at    := least(coalesce(new.expires_at, now() + interval '2 hours'), now() + interval '6 hours');
  if new.expires_at <= now() then
    new.expires_at := now() + interval '2 hours';
  end if;
  return new;
end $$;

create trigger incidents_before_insert
  before insert on public.incidents
  for each row execute function public.incidents_before_insert();

create function public.confirmations_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.incidents where id = new.incident_id and created_by = new.user_id) then
    raise exception 'you cannot confirm your own report' using errcode = 'P0001';
  end if;
  update public.incidents set confirmations = confirmations + 1 where id = new.incident_id;
  return new;
end $$;

create trigger confirmations_after_insert
  after insert on public.incident_confirmations
  for each row execute function public.confirmations_after_insert();

-- Three independent flags hide a report pending review.
create function public.flags_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.incidents
     set flags = flags + 1,
         hidden = (flags + 1) >= 3
   where id = new.incident_id;
  return new;
end $$;

create trigger flags_after_insert
  after insert on public.incident_flags
  for each row execute function public.flags_after_insert();

revoke execute on function public.incidents_before_insert()   from public, anon, authenticated;
revoke execute on function public.confirmations_after_insert() from public, anon, authenticated;
revoke execute on function public.flags_after_insert()         from public, anon, authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.incidents              enable row level security;
alter table public.incident_confirmations enable row level security;
alter table public.incident_flags         enable row level security;

create policy incidents_read_active on public.incidents
  for select to anon, authenticated
  using (not hidden and expires_at > now());

create policy incidents_insert_own on public.incidents
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy incidents_delete_own on public.incidents
  for delete to authenticated
  using (created_by = (select auth.uid()));

create policy confirmations_read_own on public.incident_confirmations
  for select to authenticated using (user_id = (select auth.uid()));
create policy confirmations_insert_own on public.incident_confirmations
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy flags_read_own on public.incident_flags
  for select to authenticated using (user_id = (select auth.uid()));
create policy flags_insert_own on public.incident_flags
  for insert to authenticated with check (user_id = (select auth.uid()));

-- Clients never update incidents directly (counters are trigger-maintained).
revoke update on public.incidents from anon, authenticated;
revoke insert, update, delete on public.incidents from anon;

-- ---------------------------------------------------------------- realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.incidents;
  end if;
end $$;
