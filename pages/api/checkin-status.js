import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { wallet } = req.query;
  if (!wallet) return res.status(400).json({ error: 'Wallet address is required' });

  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('wallet', wallet)
    .single();

  if (error) return res.status(200).json({ alreadyCheckedIn: false, streak: 1 });

  const lastCheckin = new Date(data.last_checkin);
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  lastCheckin.setUTCHours(0, 0, 0, 0);

  const alreadyCheckedIn = now.getTime() === lastCheckin.getTime();
  return res.status(200).json({ alreadyCheckedIn, streak: data.streak_count });
}
