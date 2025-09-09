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

    // Still require a valid tweet URL, but do NOT store it.
    if (!tweetUrl || !isValidTweetUrl(tweetUrl)) {
      return res.status(400).json({ ok:false, error:"Valid X/Twitter status URL required" });
    }

    // Latest draw start
    const { data: lastDraw, error: de } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (de) return res.status(500).json({ ok:false, error: de.message });

    const drawStart = lastDraw?.draw_date || null;

    // One free credit per wallet per draw (by timestamp window)
    if (drawStart) {
      const { count, error: ce } = await supabase
        .from("pending_tickets")
        .select("*", { count: "exact", head: true })
        .eq("wallet", wallet)
        .eq("is_redeemed", true)
        .eq("is_consumed", false)
        .gte("created_at", drawStart);
      if (ce) return res.status(500).json({ ok:false, error: ce.message });
      if ((count || 0) > 0) {
        return res.status(409).json({ ok:false, error:"Already claimed a free ticket this draw" });
      }
    }

    // Insert credit (NO tweet_url field)
    const { data: row, error: ie } = await supabase
      .from("pending_tickets")
      .insert({
        wallet,
        ticket_type: "free",
        is_redeemed: true,
        is_consumed: false
      })
      .select("id")
      .single();
    if (ie) return res.status(500).json({ ok:false, error: ie.message });

    return res.status(200).json({ ok:true, pending_ticket_id: row.id });
  } catch (e) {
    console.error("claimFreeTicket error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}

