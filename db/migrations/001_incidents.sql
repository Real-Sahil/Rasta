-- Buraq Pakistan: community incident reports (Neon Postgres).
-- Only the serverless API talks to this database. Identity is a signed per-device id; the database enforces
-- content limits, server-controlled fields, rate limits and the confirmation/flag rules itself.

create table incidents (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null,                 -- device id from the signed token
  ip_hash         text not null,                 -- salted hash, used only for abuse limits
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
create index incidents_active_idx on incidents (expires_at) where not hidden;
create index incidents_owner_idx  on incidents (created_by, created_at desc);
create index incidents_ip_idx     on incidents (ip_hash, created_at desc);

create table incident_confirmations (
  incident_id uuid not null references incidents (id) on delete cascade,
  device_id   uuid not null,
  ip_hash     text not null,
  created_at  timestamptz not null default now(),
  primary key (incident_id, device_id)
);
create index incident_confirmations_ip_idx on incident_confirmations (ip_hash, created_at desc);

create table incident_flags (
  incident_id uuid not null references incidents (id) on delete cascade,
  device_id   uuid not null,
  ip_hash     text not null,
  created_at  timestamptz not null default now(),
  primary key (incident_id, device_id)
);
create index incident_flags_ip_idx on incident_flags (ip_hash, created_at desc);

-- Clients only supply content; ownership counters and lifetime are decided here.
create function incidents_before_insert() returns trigger language plpgsql as $$
begin
  if (select count(*) from incidents where created_by = new.created_by and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  if (select count(*) from incidents where ip_hash = new.ip_hash and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  new.created_at    := now();
  new.confirmations := 0;
  new.flags         := 0;
  new.hidden        := false;
  new.expires_at    := least(coalesce(new.expires_at, now() + interval '2 hours'), now() + interval '6 hours');
  if new.expires_at <= now() then new.expires_at := now() + interval '2 hours'; end if;
  return new;
end $$;
create trigger incidents_before_insert before insert on incidents
  for each row execute function incidents_before_insert();

create function confirmations_before_insert() returns trigger language plpgsql as $$
begin
  if (select count(*) from incident_confirmations where ip_hash = new.ip_hash and created_at > now() - interval '1 hour') >= 120 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  if exists (select 1 from incidents where id = new.incident_id and created_by = new.device_id) then
    raise exception 'own_report' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger confirmations_before_insert before insert on incident_confirmations
  for each row execute function confirmations_before_insert();

create function confirmations_after_insert() returns trigger language plpgsql as $$
begin
  update incidents set confirmations = confirmations + 1 where id = new.incident_id;
  return new;
end $$;
create trigger confirmations_after_insert after insert on incident_confirmations
  for each row execute function confirmations_after_insert();

create function flags_before_insert() returns trigger language plpgsql as $$
begin
  if (select count(*) from incident_flags where ip_hash = new.ip_hash and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate_limit' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger flags_before_insert before insert on incident_flags
  for each row execute function flags_before_insert();

-- Three independent flags hide a report pending review.
create function flags_after_insert() returns trigger language plpgsql as $$
begin
  update incidents set flags = flags + 1, hidden = (flags + 1) >= 3 where id = new.incident_id;
  return new;
end $$;
create trigger flags_after_insert after insert on incident_flags
  for each row execute function flags_after_insert();
