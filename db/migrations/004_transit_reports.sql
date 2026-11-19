-- Community fare and delay reports. Anonymous (signed device id), no location, no free text.
-- Stats are computed on read and only shown with enough independent devices; the database enforces limits itself.

create table transit_reports (
  id         uuid primary key default gen_random_uuid(),
  created_by uuid not null,
  ip_hash    text not null,
  city       text not null check (city in ('lahore','karachi','islamabad','rawalpindi','multan','faisalabad')),
  kind       text not null check (kind in ('fare','delay')),
  mode       text not null check (mode in ('metrobus','orange_line','bus','van','rickshaw','taxi','ride_hail')),
  value      integer not null,                       -- PKR for a fare, minutes late for a delay
  created_at timestamptz not null default now(),
  check ((kind = 'fare' and value between 1 and 20000) or (kind = 'delay' and value between 1 and 240))
);
create index transit_reports_stats_idx on transit_reports (city, kind, mode, created_at desc);
create index transit_reports_owner_idx on transit_reports (created_by, created_at desc);
create index transit_reports_ip_idx    on transit_reports (ip_hash, created_at desc);

create function transit_reports_before_insert() returns trigger language plpgsql as $$
begin
  if (select count(*) from transit_reports where created_by = new.created_by and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  if (select count(*) from transit_reports where ip_hash = new.ip_hash and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  -- the same device cannot repeat the same report within 10 minutes
  if exists (select 1 from transit_reports where created_by = new.created_by and city = new.city and kind = new.kind
               and mode = new.mode and created_at > now() - interval '10 minutes') then
    raise exception 'duplicate_report' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger transit_reports_before_insert before insert on transit_reports
  for each row execute function transit_reports_before_insert();

-- Same lock-down as the other tables (see 002).
alter table transit_reports enable row level security;
revoke all on transit_reports from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on transit_reports from %I', r);
    end if;
  end loop;
end $$;
