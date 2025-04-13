import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { wallet, tweetUrl, isBonus = false } = req.body;

  if (!wallet || !tweetUrl) {
    return res.status(400).json({ error: 'Missing wallet or tweet URL' });
  }

  console.log("Received payload:", { wallet, tweetUrl, isBonus });

  try {
    const { start, end } = getDrawWindow();
    console.log("Checking between:", start.toISOString(), "and", end.toISOString());

    const { data: existing, error: selectError } = await supabase
      .from('free_entries')
      .select('*')
      .eq('wallet', wallet)
      .eq('is_bonus', isBonus)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());

    if (selectError) {
      console.error("Supabase select error:", selectError);
      return res.status(500).json({ error: 'Database error (select)' });
    }

    if (existing.length > 0) {
      console.log("Entry already exists for this wallet + bonus type.");
      return res.status(400).json({ error: 'Already claimed this entry type this week' });
    }

    const { error: insertError } = await supabase.from('free_entries').insert([
      { wallet, tweet_url: tweetUrl, is_bonus: isBonus },
    ]);

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return res.status(500).json({ error: 'Database error (insert)' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Unhandled exception:", err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}

// === Get draw window from last Monday 10pm CT to next Monday 10pm CT
function getDrawWindow() {
  const now = new Date();
  const day = now.getUTCDay(); // Sunday = 0
  const date = now.getUTCDate();

  const daysSinceMonday = (day + 6) % 7;

  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    date - daysSinceMonday,
    3, 0, 0, 0 // Monday 10pm CT = Tuesday 3am UTC
  ));

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);

  return { start, end };
}
