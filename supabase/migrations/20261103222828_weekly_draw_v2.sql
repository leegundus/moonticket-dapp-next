begin;

alter table public.entries
  add column if not exists weekly_draw_key date;

alter table public.draws
  add column if not exists draw_key date,
  add column if not exists prize_bundle jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'legacy',
  add column if not exists randomness_slot bigint,
  add column if not exists randomness_blockhash text,
  add column if not exists entries_hash text,
  add column if not exists winner_entry_id uuid references public.entries(id),
  add column if not exists prepared_at timestamptz,
  add column if not exists finalized_at timestamptz,
  add column if not exists payout_status text,
  add column if not exists payout_tx_signatures jsonb not null default '[]'::jsonb,
  add column if not exists created_at timestamptz not null default now();

with ranked as (
  select
    id,
    (
      date_trunc(
        'week',
        (created_at at time zone 'America/Chicago') - interval '22 hours'
      ) + interval '7 days'
    )::date as draw_key,
    row_number() over (
      partition by
        wallet,
        (
          date_trunc(
            'week',
            (created_at at time zone 'America/Chicago') - interval '22 hours'
          ) + interval '7 days'
        )::date
      order by created_at, id
    ) as rn
  from public.entries
  where entry_type = 'free'
)
update public.entries e
set weekly_draw_key = r.draw_key
from ranked r
where e.id = r.id
  and r.rn = 1
  and e.weekly_draw_key is null;

create unique index if not exists entries_one_free_per_wallet_week
  on public.entries(wallet, weekly_draw_key)
  where entry_type = 'free' and weekly_draw_key is not null;

create index if not exists entries_weekly_draw_lookup
  on public.entries(weekly_draw_key, entry_type, wallet);

create unique index if not exists draws_one_weekly_draw
  on public.draws(draw_key)
  where draw_key is not null;

commit;
