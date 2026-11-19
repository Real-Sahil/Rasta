-- Error reports from the Flutter app: a platform column and two more kinds.
-- 'flutter' = a framework/zone error; 'caught' = an error the app handled but wants to know about (search, routing).
alter table client_errors add column platform text not null default 'web' check (platform in ('web', 'android', 'ios'));
alter table client_errors drop constraint client_errors_kind_check;
alter table client_errors add constraint client_errors_kind_check
  check (kind in ('error', 'unhandledrejection', 'react', 'flutter', 'caught'));
