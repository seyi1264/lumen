alter table autopilot_jobs add column if not exists user_id text;
alter table autopilot_jobs
  add constraint autopilot_jobs_user_id_fkey
  foreign key (user_id) references "user" ("id") on delete cascade not valid;
alter table autopilot_jobs
  add constraint autopilot_jobs_user_id_required
  check (user_id is not null) not valid;

create index if not exists autopilot_jobs_user_schedule_idx
  on autopilot_jobs (user_id, scheduled_for);