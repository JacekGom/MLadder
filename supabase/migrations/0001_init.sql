-- Drabinka muzyczna: initial schema.
-- Run once in Supabase: SQL Editor -> paste -> Run.
-- The app talks to the database only from the server with the service role
-- key, so RLS is enabled with no policies (anon/public clients get nothing).

create extension if not exists pgcrypto;

-- Spotify users who have logged in. id = Spotify user id.
create table users (
  id            text primary key,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

-- One ladder = one set of 2^n songs sent by a sender to one recipient.
create table ladders (
  id            uuid primary key default gen_random_uuid(),
  sender_id     text not null references users(id) on delete cascade,
  -- Filled in when someone opens the share link and logs in.
  recipient_id  text references users(id) on delete set null,
  -- Unguessable token used in the share link.
  share_token   text not null unique default encode(gen_random_bytes(12), 'hex'),
  size          int  not null check (size in (4, 8, 16, 32)),
  status        text not null default 'pending'
                check (status in ('pending', 'in_progress', 'done')),
  message       text,
  winner_track_id text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index ladders_sender_idx on ladders (sender_id, created_at desc);
create index ladders_recipient_idx on ladders (recipient_id, created_at desc);

-- Songs in a ladder, with enough metadata to render without calling Spotify.
-- seed is the random bracket position (0 .. size-1), set when the
-- recipient starts the ladder.
create table ladder_tracks (
  ladder_id        uuid not null references ladders(id) on delete cascade,
  spotify_track_id text not null,
  name             text not null,
  artists          text not null,
  album_image_url  text,
  duration_ms      int,
  seed             int,
  primary key (ladder_id, spotify_track_id),
  unique (ladder_id, seed)
);

-- Duels. round 0 is the first round; slot is the duel's index in its round.
-- Round r has size / 2^(r+1) slots; the winners of slots 2k and 2k+1 meet
-- in slot k of round r+1.
create table ladder_matches (
  ladder_id  uuid not null references ladders(id) on delete cascade,
  round      int  not null check (round >= 0),
  slot       int  not null check (slot >= 0),
  track_a    text not null,
  track_b    text not null,
  winner     text check (winner is null or winner = track_a or winner = track_b),
  decided_at timestamptz,
  primary key (ladder_id, round, slot)
);

alter table users          enable row level security;
alter table ladders        enable row level security;
alter table ladder_tracks  enable row level security;
alter table ladder_matches enable row level security;
