import { createClient } from "@supabase/supabase-js";

function isValidTweetUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    const allowed = ["x.com","www.x.com","twitter.com","www.twitter.com","mobile.twitter.com"];
    if (!allowed.includes(host)) return false;
    return /^\/[A-Za-z0-9_]{1,15}\/status\/\d+/.test(url.pathname);
  } catch { return false; }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try {
    const { wallet, tweetUrl } = req.body || {};
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });
    if (!tweetUrl || !isValidTweetUrl(tweetUrl)) {
      return res.status(400).json({ ok:false, error:"Valid X/Twitter status URL required" });
    }

    // Anchor to latest draw (credits scoped per draw)
    const { data: lastDraw, error: de } = await supabase
      .from("draws")
      .select("id")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (de) return res.status(500).json({ ok:false, error: de.message });

    const drawId = lastDraw?.id || null;

    const { data: row, error: ie } = await supabase
      .from("pending_tickets")
      .insert({
        wallet,
        draw_id: drawId,
        ticket_type: "free",
        is_redeemed: true,  // credit model
        is_consumed: false,
        tweet_url: tweetUrl
      })
      .select("id")
      .single();

    if (ie) {
      if (ie.code === "23505") return res.status(409).json({ ok:false, error:"Already claimed this draw" });
      return res.status(500).json({ ok:false, error: ie.message });
    }

    return res.status(200).json({ ok:true, pending_ticket_id: row.id });
  } catch (e) {
    console.error("claimFreeTicket error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
