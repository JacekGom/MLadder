-- Drabinka muzyczna: edit name/message before sending + delete from profile
-- (run after 0005).

alter table ladders add column if not exists sender_hidden_at timestamptz;
alter table ladders add column if not exists recipient_hidden_at timestamptz;

-- The sender changes the name and message while nobody has started yet.
create or replace function update_ladder_text(
  p_ladder uuid, p_user text, p_name text, p_message text)
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
  if l.sender_id <> p_user then
    raise exception 'forbidden';
  end if;
  if l.status <> 'pending' then
    raise exception 'not_pending';
  end if;
  update ladders
     set name = nullif(left(trim(p_name), 80), ''),
         message = nullif(left(trim(p_message), 280), '')
   where id = p_ladder;
end;
$$;

-- Removes a ladder from the caller's profile. Once everyone involved has
-- removed it (sender, and the recipient if there is one), the ladder is
-- deleted together with its songs and duels. Returns 'deleted' or 'hidden'.
create or replace function delete_ladder(p_ladder uuid, p_user text)
returns text
language plpgsql
as $$
declare
  l ladders;
begin
  select * into l from ladders where id = p_ladder for update;
  if not found then
    raise exception 'not_found';
  end if;
  if l.sender_id <> p_user and l.recipient_id is distinct from p_user then
    raise exception 'forbidden';
  end if;

  if l.sender_id = p_user then
    l.sender_hidden_at := coalesce(l.sender_hidden_at, now());
  end if;
  if l.recipient_id = p_user then
    l.recipient_hidden_at := coalesce(l.recipient_hidden_at, now());
  end if;

  if l.sender_hidden_at is not null
     and (l.recipient_id is null or l.recipient_hidden_at is not null) then
    delete from ladders where id = p_ladder;
    return 'deleted';
  end if;

  update ladders
     set sender_hidden_at = l.sender_hidden_at,
         recipient_hidden_at = l.recipient_hidden_at
   where id = p_ladder;
  return 'hidden';
end;
$$;

revoke execute on function update_ladder_text(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function delete_ladder(uuid, text) from public, anon, authenticated;
