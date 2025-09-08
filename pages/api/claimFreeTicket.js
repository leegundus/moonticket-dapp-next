const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });
    const { wallet, tweetUrl } = req.body || {};
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // latest draw (current period anchor)
    const { data: lastDraw, error: de } = await supabase
      .from("draws")
      .select("id, draw_time")
      .order("draw_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (de) return res.status(500).json({ ok:false, error:de.message });

    const drawId = lastDraw?.id || null;

    // insert pending ticket
    const { data: row, error: ie } = await supabase
      .from("pending_tickets")
      .insert({
        wallet,
        draw_id: drawId,
        ticket_type: "free",
        tweet_url: tweetUrl || null
      })
      .select("id")
      .single();

    if (ie) {
      // unique index violation => already claimed
      if (ie.code === "23505") {
        return res.status(409).json({ ok:false, error:"Already claimed this draw" });
      }
      return res.status(500).json({ ok:false, error:ie.message });
    }

    return res.status(200).json({ ok:true, pending_ticket_id: row.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:e.message });
  }
};
