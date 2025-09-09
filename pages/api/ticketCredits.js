import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }
  try {
    const wallet = req.query.wallet;
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });

    // Count any pending_tickets rows not yet consumed (works for both 'tweet' & ‘purchase’ sources)
    const { data: rows, error } = await supabase
      .from("pending_tickets")
      .select("id", { count: "exact", head: false })
      .eq("wallet", wallet)
      .eq("is_redeemed", false)
      .eq("is_consumed", false);

    if (error) return res.status(500).json({ ok:false, error: error.message });
    return res.status(200).json({ ok:true, credits: rows?.length || 0 });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}
