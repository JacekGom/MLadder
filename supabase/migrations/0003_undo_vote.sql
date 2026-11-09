-- Drabinka muzyczna: undo the last pick (run after 0002).
-- Reverts the most recently decided duel of a ladder: removes the
-- next-round duel it created (which can't have been decided yet, since
-- this is the latest pick) and, after the final, reopens the ladder.
-- Returns false when there is nothing to undo.
create or replace function undo_last_vote(p_ladder uuid, p_user text)
returns boolean
language plpgsql
as $$
declare
  l ladders;
  m ladder_matches;
begin
  select * into l from ladders where id = p_ladder for update;
  if not found then
    raise exception 'not_found';
  end if;
  if l.recipient_id is distinct from p_user then
    raise exception 'forbidden';
  end if;

  select * into m from ladder_matches
   where ladder_id = p_ladder and winner is not null
   order by decided_at desc, round desc, slot desc
   limit 1;
  if not found then
    return false;
  end if;

  delete from ladder_matches
   where ladder_id = p_ladder
     and round = m.round + 1
     and slot = m.slot / 2
     and winner is null;

  update ladder_matches
     set winner = null, decided_at = null
   where ladder_id = p_ladder and round = m.round and slot = m.slot;

  if l.status = 'done' then
    update ladders
       set status = 'in_progress', winner_track_id = null, completed_at = null
     where id = p_ladder;
  end if;

  return true;
end;
$$;

revoke execute on function undo_last_vote(uuid, text) from public, anon, authenticated;
grant execute on function undo_last_vote(uuid, text) to service_role;
