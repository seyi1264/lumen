create table if not exists autopilot_jobs (
  id text primary key,
  title text not null,
  platform text not null,
  status text not null default 'queued',
  scheduled_for timestamptz,
  body text not null default '',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autopilot_jobs_status_idx on autopilot_jobs (status);
create index if not exists autopilot_jobs_scheduled_idx on autopilot_jobs (scheduled_for);
