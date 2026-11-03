import { supabaseRest } from "../../lib/supabaseRestServer";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const q = new URLSearchParams({
      select: "id,draw_key,draw_date,status,prize_bundle,entries,winner,randomness_slot,randomness_blockhash,entries_hash,payout_status,payout_tx_signatures,tx_signature,finalized_at",
      draw_type: "eq.weekly_free",
      winner: "not.is.null",
      order: "draw_date.desc",
      limit: String(limit),
    });
    const draws = await supabaseRest("draws?" + q.toString());
    return res.status(200).json({ items: Array.isArray(draws) ? draws : [] });
  } catch (err) {
    console.error("pastDraws error:", err?.message, err?.details || "");
    return res.status(500).json({ error: "Failed to load winners." });
  }
}
