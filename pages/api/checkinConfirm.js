import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet, streak } = req.body;

  if (!wallet || typeof streak !== 'number') {
    return res.status(400).json({ error: 'Missing or invalid wallet or streak' });
  }

  const today = new Date().toISOString();

  try {
    const { data, error: selectError } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('wallet', wallet)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error("❌ Supabase SELECT error:", selectError.message);
      return res.status(500).json({ error: 'Database read error' });
    }

    if (data) {
      const { error: updateError } = await supabase
        .from('daily_checkins')
        .update({
          last_checkin: today,
          streak_count: streak,
        })
        .eq('wallet', wallet);

      if (updateError) {
        console.error("❌ Supabase UPDATE error:", updateError.message);
        return res.status(500).json({ error: 'Failed to update streak' });
      }
    } else {
      const { error: insertError } = await supabase
        .from('daily_checkins')
        .insert({
          wallet,
          last_checkin: today,
          streak_count: 1,
        });

      if (insertError) {
        console.error("❌ Supabase INSERT error:", insertError.message);
        return res.status(500).json({ error: 'Failed to insert new check-in' });
      }
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("❌ Unexpected error in checkinConfirm:", e);
    return res.status(500).json({ error: 'Unexpected server error', detail: e.message });
  }
}

