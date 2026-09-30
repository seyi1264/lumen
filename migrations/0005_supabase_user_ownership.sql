-- Supabase Auth identities are not stored in the legacy Better Auth "user" table.
-- Keep existing rows, but remove the constraints that require that legacy table.
alter table autopilot_jobs
  drop constraint if exists autopilot_jobs_user_id_fkey;

alter table buffer_connections
  drop constraint if exists buffer_connections_user_id_fkey;