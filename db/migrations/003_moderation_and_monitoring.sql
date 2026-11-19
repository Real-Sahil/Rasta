-- Moderation, duplicate suppression and a small client-error log.

-- 1. Admin review: an admin-restored report is not re-hidden by later flags.
alter table incidents add column reviewed boolean not null default false;

create or replace function incidents_before_insert() returns trigger language plpgsql as $$
begin
  if (select count(*) from incidents where created_by = new.created_by and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  if (select count(*) from incidents where ip_hash = new.ip_hash and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  -- Same device, same headline within an hour, or same category within ~110 m in 10 minutes: a duplicate.
  if exists (select 1 from incidents where created_by = new.created_by and created_at > now() - interval '1 hour'
               and lower(btrim(title)) = lower(btrim(new.title)))
     or exists (select 1 from incidents where created_by = new.created_by and created_at > now() - interval '10 minutes'
               and category = new.category and abs(lat - new.lat) < 0.001 and abs(lng - new.lng) < 0.001) then
    raise exception 'duplicate_report' using errcode = 'P0001';
  end if;
  new.created_at    := now();
  new.confirmations := 0;
  new.flags         := 0;
  new.hidden        := false;
  new.reviewed      := false;
  new.expires_at    := least(coalesce(new.expires_at, now() + interval '2 hours'), now() + interval '6 hours');
  if new.expires_at <= now() then new.expires_at := now() + interval '2 hours'; end if;
  return new;
end $$;

create or replace function flags_after_insert() returns trigger language plpgsql as $$
begin
  update incidents set flags = flags + 1, hidden = (not reviewed) and (flags + 1) >= 3 where id = new.incident_id;
  return new;
end $$;

-- 2. Client error log (written by the API only; read from the admin page).
create table client_errors (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  ip_hash    text not null,
  kind       text not null check (kind in ('error', 'unhandledrejection', 'react')),
  message    text not null check (char_length(message) <= 500),
  stack      text check (stack is null or char_length(stack) <= 2000),
  url        text check (url is null or char_length(url) <= 300),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  release    text check (release is null or char_length(release) <= 40)
);
create index client_errors_created_idx on client_errors (created_at desc);
create index client_errors_ip_idx on client_errors (ip_hash, created_at desc);

create function client_errors_before_insert() returns trigger language plpgsql as $$
begin
  if (select count(*) from client_errors where ip_hash = new.ip_hash and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end $$;
create trigger client_errors_before_insert before insert on client_errors
  for each row execute function client_errors_before_insert();

alter table client_errors enable row level security;
revoke all on client_errors from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on client_errors from %I', r);
    end if;
  end loop;
end $$;
