-- Drabinka muzyczna: send the result back to the sender + copy a ladder
-- (run after 0004).

alter table ladders add column if not exists reply_message text;
alter table ladders add column if not exists returned_at timestamptz;

-- The player sends a finished ladder back to the sender, with an optional
-- message. Calling it again updates the message.
create or replace function return_ladder(p_ladder uuid, p_user text, p_message text)
returns void
language plpgsql
as $$
declare
  l ladders;
begin
  select * into l from ladders where id = p_ladder for update;
  if not found then
    raise exception 'not_found';
  end if;
  if l.recipient_id is distinct from p_user then
    raise exception 'forbidden';
  end if;
  if l.status <> 'done' then
    raise exception 'not_done';
  end if;
  update ladders
     set reply_message = nullif(left(trim(p_message), 280), ''),
         returned_at = now()
   where id = p_ladder;
end;
$$;

-- Playing again also takes back a result that was already sent.
create or replace function restart_ladder(p_ladder uuid, p_user text)
returns boolean
language plpgsql
as $$
declare
  l ladders;
begin
  select * into l from ladders where id = p_ladder for update;
  if not found then
    raise exception 'not_found';
  end if;
  if l.recipient_id is distinct from p_user then
    raise exception 'forbidden';
  end if;
  if l.status <> 'done' then
    return false;
  end if;

  delete from ladder_matches where ladder_id = p_ladder;
  update ladder_tracks set seed = null where ladder_id = p_ladder;
  update ladders
     set recipient_id = null, status = 'pending',
         winner_track_id = null, completed_at = null,
         reply_message = null, returned_at = null
   where id = p_ladder;

  return start_ladder(p_ladder, p_user);
end;
$$;

-- Copies a ladder's songs, name and message into a new, unplayed ladder
-- with its own share link. Returns the new share token.
create or replace function copy_ladder(p_ladder uuid, p_user text)
returns text
language plpgsql
as $$
declare
  l ladders;
  new_id uuid;
  new_token text;
begin
  select * into l from ladders where id = p_ladder;
  if not found then
    raise exception 'not_found';
  end if;
  if l.sender_id <> p_user then
    raise exception 'forbidden';
  end if;

  insert into ladders (sender_id, size, name, message)
  values (l.sender_id, l.size, l.name, l.message)
  returning id, share_token into new_id, new_token;

  insert into ladder_tracks
    (ladder_id, spotify_track_id, name, artists, album_image_url, duration_ms)
  select new_id, spotify_track_id, name, artists, album_image_url, duration_ms
    from ladder_tracks
   where ladder_id = p_ladder;

  return new_token;
end;
$$;

revoke execute on function return_ladder(uuid, text, text) from public, anon, authenticated;
revoke execute on function copy_ladder(uuid, text) from public, anon, authenticated;
grant execute on function return_ladder(uuid, text, text) to service_role;
grant execute on function copy_ladder(uuid, text) to service_role;
