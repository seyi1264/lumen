create table if not exists buffer_connections (
  user_id text primary key references "user" ("id") on delete cascade,
  api_key_ciphertext text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);