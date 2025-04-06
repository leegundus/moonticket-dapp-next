import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('draws')
    .select('*')
    .order('draw_date', { ascending: false })
    .limit(10); // last 10 draws

  if (error) {
    console.error("Error fetching past draws:", error);
    return res.status(500).json({ error: "Failed to fetch past draws" });
  }

  res.status(200).json(data);
}
