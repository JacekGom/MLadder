-- Drabinka muzyczna: bracket logic (step 3).
-- Run once in Supabase: SQL Editor -> paste -> Run (after 0001_init.sql).
-- Both functions run in one transaction each and lock the ladder row, so
-- double taps or two open tabs can't corrupt the bracket.

-- Claims a pending ladder for p_user, shuffles the songs into random seeds
-- and creates the first-round duels. Returns true when p_user is (now) the
-- ladder's player, false when someone else already claimed it.
create or replace function start_ladder(p_ladder uuid, p_user text)
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
  if l.recipient_id is not null then
    return l.recipient_id = p_user;
  end if;

  update ladders
     set recipient_id = p_user, status = 'in_progress'
   where id = p_ladder;

  with shuffled as (
    select spotify_track_id,
           (row_number() over (order by random()) - 1)::int as s
      from ladder_tracks
     where ladder_id = p_ladder
  )
  update ladder_tracks t
     set seed = sh.s
    from shuffled sh
   where t.ladder_id = p_ladder
     and t.spotify_track_id = sh.spotify_track_id;

  -- Seeds 2k and 2k+1 meet in slot k of round 0.
  insert into ladder_matches (ladder_id, round, slot, track_a, track_b)
  select p_ladder, 0, a.seed / 2, a.spotify_track_id, b.spotify_track_id
    from ladder_tracks a
    join ladder_tracks b
      on b.ladder_id = a.ladder_id and b.seed = a.seed + 1
   where a.ladder_id = p_ladder
     and a.seed % 2 = 0;

  return true;
end;
$$;

-- Records p_user's pick in one duel. When the neighbouring duel is also
-- decided, creates the next-round duel; after the final, finishes the
-- ladder. Returns 'done' after the final, otherwise 'ok'.
create or replace function vote_ladder(
  p_ladder uuid, p_user text, p_round int, p_slot int, p_winner text
)
returns text
language plpgsql
as $$
declare
  l ladders;
  m ladder_matches;
  sib ladder_matches;
  rounds int;
begin
  select * into l from ladders where id = p_ladder for update;
  if not found then
    raise exception 'not_found';
  end if;
  if l.recipient_id is distinct from p_user then
    raise exception 'forbidden';
  end if;
  if l.status <> 'in_progress' then
    raise exception 'not_in_progress';
  end if;

  select * into m from ladder_matches
   where ladder_id = p_ladder and round = p_round and slot = p_slot;
  if not found or m.winner is not null then
    raise exception 'bad_match';
  end if;
  if p_winner <> m.track_a and p_winner <> m.track_b then
    raise exception 'bad_winner';
  end if;

  update ladder_matches
     set winner = p_winner, decided_at = now()
   where ladder_id = p_ladder and round = p_round and slot = p_slot;

  rounds := round(ln(l.size) / ln(2))::int;
  if p_round = rounds - 1 then
    update ladders
       set status = 'done', winner_track_id = p_winner, completed_at = now()
     where id = p_ladder;
    return 'done';
  end if;

  -- Neighbour duel: slots 2k and 2k+1 feed slot k of the next round.
  select * into sib from ladder_matches
   where ladder_id = p_ladder and round = p_round and slot = (p_slot # 1);
  if found and sib.winner is not null then
    insert into ladder_matches (ladder_id, round, slot, track_a, track_b)
    values (
      p_ladder, p_round + 1, p_slot / 2,
      case when p_slot % 2 = 0 then p_winner else sib.winner end,
      case when p_slot % 2 = 0 then sib.winner else p_winner end
    );
  end if;

  return 'ok';
end;
$$;

-- Only the app's server (service role) may call these; the Data API would
-- otherwise expose them to anyone with the publishable key.
revoke execute on function start_ladder(uuid, text) from public, anon, authenticated;
revoke execute on function vote_ladder(uuid, text, int, int, text) from public, anon, authenticated;
grant execute on function start_ladder(uuid, text) to service_role;
grant execute on function vote_ladder(uuid, text, int, int, text) to service_role;
