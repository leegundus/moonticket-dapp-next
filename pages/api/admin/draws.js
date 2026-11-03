import { supabaseRest } from "../../../lib/supabaseRestServer";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const q = new URLSearchParams({
      select: "id,draw_key,draw_date,status,prize_bundle,entries,winner,randomness_slot,randomness_blockhash,entries_hash,payout_status,payout_tx_signatures,prepared_at,finalized_at",
      draw_type: "eq.weekly_free",
      order: "draw_date.desc",
      limit: "8",
    });
    const draws = await supabaseRest("draws?" + q.toString());
    return res.status(200).json({ items: Array.isArray(draws) ? draws : [] });
  } catch (err) {
    console.error("admin draws error:", err?.message);
    return res.status(500).json({ error: "Could not load drawings." });
  }
}
