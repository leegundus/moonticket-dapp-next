const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    const wallet = req.query.wallet;
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: lastDraw } = await supabase.from("draws").select("id").order("draw_time",{ascending:false}).limit(1).maybeSingle();
    const drawId = lastDraw?.id || null;

    const { data: rows, error } = await supabase
      .from("pending_tickets")
      .select("id")
      .eq("wallet", wallet)
      .eq("is_redeemed", true)
      .eq("is_consumed", false)
      .eq("draw_id", drawId);

    if (error) return res.status(500).json({ ok:false, error:error.message });
    return res.status(200).json({ ok:true, credits: rows?.length || 0 });
  } catch (e) {
    return res.status(500).json({ ok:false, error:e.message });
  }
};
