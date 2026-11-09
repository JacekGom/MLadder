-- Drabinka muzyczna: ladder name + play again (run after 0003).

alter table ladders add column if not exists name text;

-- Plays a finished ladder again from scratch: forgets the previous result,
-- reshuffles the seeds and creates fresh first-round duels for the same
-- player. Returns false when the ladder isn't finished.
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
         winner_track_id = null, completed_at = null
   where id = p_ladder;

  -- Same lock/transaction: re-claim, reshuffle and create round 0.
  return start_ladder(p_ladder, p_user);
end;
$$;

revoke execute on function restart_ladder(uuid, text) from public, anon, authenticated;
grant execute on function restart_ladder(uuid, text) to service_role;
