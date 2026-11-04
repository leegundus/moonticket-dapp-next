begin;

alter table public.daily_checkins
  add column if not exists pending_tix bigint not null default 0,
  add column if not exists lifetime_tix bigint not null default 0,
  add column if not exists last_reward_tix bigint not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.daily_tix_reward_events (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  checkin_date date not null,
  streak_day smallint not null check (streak_day between 1 and 7),
  reward_tix bigint not null check (reward_tix > 0),
  created_at timestamptz not null default now(),
  unique (wallet, checkin_date)
);

alter table public.daily_tix_reward_events enable row level security;
revoke all on table public.daily_tix_reward_events from anon, authenticated;
grant all on table public.daily_tix_reward_events to service_role;

create index if not exists daily_tix_reward_events_wallet_date_idx
  on public.daily_tix_reward_events(wallet, checkin_date desc);

create or replace function public.claim_daily_tix_reward(p_wallet text)
returns table (
  success boolean,
  already_checked_in boolean,
  streak_day integer,
  reward_tix bigint,
  pending_tix bigint,
  lifetime_tix bigint,
  last_checkin timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Chicago')::date;
  v_last_date date;
  v_streak integer := 1;
  v_reward bigint := 100;
  v_inserted uuid;
  v_state public.daily_checkins%rowtype;
begin
  if p_wallet is null or p_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'Invalid Solana wallet';
  end if;

  select * into v_state
  from public.daily_checkins
  where wallet = p_wallet
  for update;

  if found then
    v_last_date := (v_state.last_checkin at time zone 'America/Chicago')::date;

    if v_last_date = v_today then
      return query
      select false, true,
        least(greatest(coalesce(v_state.streak_count, 1), 1), 7),
        coalesce(v_state.last_reward_tix, 0),
        coalesce(v_state.pending_tix, 0),
        coalesce(v_state.lifetime_tix, 0),
        v_state.last_checkin;
      return;
    elsif v_last_date = v_today - 1 then
      v_streak := least(coalesce(v_state.streak_count, 0) + 1, 7);
    else
      v_streak := 1;
    end if;
  end if;

  v_reward := case v_streak
    when 1 then 100
    when 2 then 200
    when 3 then 300
    when 4 then 400
    when 5 then 500
    when 6 then 750
    else 1000
  end;

  insert into public.daily_tix_reward_events(wallet, checkin_date, streak_day, reward_tix)
  values (p_wallet, v_today, v_streak, v_reward)
  on conflict (wallet, checkin_date) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select * into v_state from public.daily_checkins where wallet = p_wallet;
    return query
    select false, true,
      least(greatest(coalesce(v_state.streak_count, 1), 1), 7),
      coalesce(v_state.last_reward_tix, 0),
      coalesce(v_state.pending_tix, 0),
      coalesce(v_state.lifetime_tix, 0),
      v_state.last_checkin;
    return;
  end if;

  insert into public.daily_checkins(
    wallet, last_checkin, streak_count, pending_tix, lifetime_tix, last_reward_tix, updated_at
  )
  values (p_wallet, now(), v_streak, v_reward, v_reward, v_reward, now())
  on conflict (wallet) do update set
    last_checkin = excluded.last_checkin,
    streak_count = excluded.streak_count,
    pending_tix = public.daily_checkins.pending_tix + excluded.pending_tix,
    lifetime_tix = public.daily_checkins.lifetime_tix + excluded.lifetime_tix,
    last_reward_tix = excluded.last_reward_tix,
    updated_at = now()
  returning * into v_state;

  return query
  select true, false, v_streak, v_reward,
    v_state.pending_tix, v_state.lifetime_tix, v_state.last_checkin;
end;
$$;

revoke all on function public.claim_daily_tix_reward(text) from public, anon, authenticated;
grant execute on function public.claim_daily_tix_reward(text) to service_role;

commit;
