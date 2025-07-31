import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Wallet is required' });

  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    let streak = 1;

    const { data, error } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('wallet', wallet)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Supabase select error:", error.message);
      return res.status(500).json({ error: 'Database error' });
    }

    if (data) {
      const lastCheck = new Date(data.last_checkin);
      lastCheck.setUTCHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today - lastCheck) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        streak = Math.min(data.streak_count + 1, 7);
      }

      await supabase
        .from('daily_checkins')
        .update({
          last_checkin: new Date().toISOString(),
          streak_count: streak,
        })
        .eq('wallet', wallet);
    } else {
      await supabase.from('daily_checkins').insert({
        wallet,
        last_checkin: new Date().toISOString(),
        streak_count: 1,
      });
    }

    return res.status(200).json({ success: true, updated: true, streak });

  } catch (e) {
    console.error("Check-in confirm error:", e.message);
    return res.status(500).json({ error: 'Check-in confirmation failed' });
  }
}
