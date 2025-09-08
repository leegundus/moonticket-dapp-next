const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  // CORS + JSON
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "GET") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try {
    const wallet = req.query.wallet;
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Latest draw
    const { data: lastDraw, error: de } = await supabase
      .from("draws").select("id")
      .order("draw_time", { ascending: false })
      .limit(1).maybeSingle();
    if (de) return res.status(500).json({ ok:false, error: de.message });

    const drawId = lastDraw?.id || null;

    // Count unconsumed credits for this wallet & draw
    const { count, error } = await supabase
      .from("pending_tickets")
      .select("*", { count: "exact", head: true })
      .eq("wallet", wallet)
      .eq("is_redeemed", true)
      .eq("is_consumed", false)
      .eq("draw_id", drawId);

    if (error) return res.status(500).json({ ok:false, error: error.message });

    return res.status(200).json({ ok:true, credits: count || 0 });
  } catch (e) {
    console.error("ticketCredits error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
};
