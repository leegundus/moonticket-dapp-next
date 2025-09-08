const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  // Accept CORS preflight
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const wallet = req.query.wallet;
    if (!wallet) return res.status(400).json({ ok: false, error: "Missing wallet" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ ok: false, error: "Server misconfigured (env)" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Latest draw anchors the credit window
    const { data: lastDraw, error: de } = await supabase
      .from("draws")
      .select("id")
      .order("draw_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (de) return res.status(500).json({ ok: false, error: de.message });

    const drawId = lastDraw?.id || null;

    // Count unconsumed credits for this wallet & draw
    const { data: rows, error } = await supabase
      .from("pending_tickets")
      .select("id", { count: "exact", head: false })
      .eq("wallet", wallet)
      .eq("is_redeemed", true)
      .eq("is_consumed", false)
      .eq("draw_id", drawId);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const credits = rows ? rows.length : 0;
    return res.status(200).json({ ok: true, credits });
  } catch (e) {
    console.error("ticketCredits error:", e);
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
};
