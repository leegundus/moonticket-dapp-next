-- MoonTicket Supabase security hardening
-- Prepared for review/testing before applying to the production database.

begin;

-- These tables are accessed by server-side API routes using the Supabase
-- service role. Remove direct anon/authenticated table privileges so they are
-- not exposed through the public Data API / GraphQL schema.
revoke all privileges on table
  public.daily_checkins,
  public.entries,
  public.free_claims,
  public.pending_tickets,
  public.prize_awards,
  public.purchases
from anon, authenticated;

-- Draw results are intentionally public, but public roles only need SELECT.
revoke insert, update, delete, truncate, references, trigger
on table public.draws
from anon, authenticated;

grant select on table public.draws to anon, authenticated;

-- These public read policies are no longer needed because private data is
-- served through server-side API routes using the service role.
drop policy if exists "Allow users to read their own entries" on public.entries;
drop policy if exists "Allow read access to purchases" on public.purchases;

commit;
