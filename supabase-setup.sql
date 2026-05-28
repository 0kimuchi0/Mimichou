-- 耳帖 Supabase セットアップ
-- Supabase の SQL Editor で実行してください

create table if not exists users (
  id text primary key,
  display_name text,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists wishlists (
  user_id text primary key references users(id) on delete cascade,
  items jsonb not null default '[]',
  updated_at timestamptz default now()
);

create table if not exists history_snapshots (
  user_id text primary key references users(id) on delete cascade,
  top_artists jsonb not null default '[]',
  top_tracks jsonb not null default '[]',
  date_range jsonb not null default '{}',
  total_entries integer not null default 0,
  uploaded_at timestamptz default now()
);
