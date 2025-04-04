import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getDrawWindowRange() {
  const now = new Date();

  const day = now.getUTCDay(); // Sunday = 0, Monday = 1
  const hour = now.getUTCHours();

  // Calculate how many days since last Monday
  let daysSinceMonday = (day + 6) % 7;
  if (day === 1 && hour < 3) daysSinceMonday = 7; // Before Monday 10pm CT (3am UTC), go back a week

  const lastDraw = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday,
    3, 0, 0 // 10pm CT == 3am UTC
  ));

  const nextDraw = new Date(lastDraw.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

  return { lastDraw, nextDraw };
}

export default async function handler(req, res) {
  const wallet = req.query.wallet;

  if (!wallet) {
    return res.status(400).json({ error: 'Missing wallet address' });
  }

  try {
    const { lastDraw, nextDraw } = getDrawWindowRange();

    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('wallet', wallet)
      .gte('created_at', lastDraw.toISOString())
      .lt('created_at', nextDraw.toISOString());

    if (error) {
      console.error('Supabase error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch user entries' });
    }

    let weeklyTix = 0;
    let weeklyUsd = 0;
    let weeklyEntries = 0;

    for (const row of data) {
      weeklyTix += row.tix_amount;
      weeklyUsd += row.amount_usd;
      weeklyEntries += row.entries;
    }

    return res.status(200).json({
      weeklyTix,
      weeklyUsd,
      weeklyEntries
    });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
