import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// basic X/Twitter status URL check (we still require a URL, we do not store it)
function isValidTweetUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    const ok = ["x.com","www.x.com","twitter.com","www.twitter.com","mobile.twitter.com"];
    if (!ok.includes(host)) return false;
    return /^\/[A-Za-z0-9_]{1,15}\/status\/\d+/.test(url.pathname);
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try {
    const { wallet, tweetUrl } = req.body || {};
    if (!wallet)   return res.status(400).json({ ok:false, error:"Missing wallet" });
    if (!tweetUrl) return res.status(400).json({ ok:false, error:"Missing tweet URL" });
    if (!isValidTweetUrl(tweetUrl)) {
      return res.status(400).json({ ok:false, error:"Valid X/Twitter status URL required" });
    }

    // latest draw (your schema uses draw_date)
    const { data: lastDraw, error: de } = await supabase
      .from("draws")
      .select("id, draw_date")
      .order("draw_date", { ascending:false })
      .limit(1)
      .maybeSingle();
    if (de) return res.status(500).json({ ok:false, error: de.message });

    const drawId = lastDraw?.id ?? null;

    // one free credit per wallet per draw
    if (drawId) {
      const { data: already } = await supabase
        .from("pending_tickets")
        .select("id")
        .eq("wallet", wallet)
        .eq("draw_id", drawId)
        .eq("source", "tweet")
        .limit(1);
      if (already && already.length) {
        return res.status(200).json({ ok:false, error:"Already claimed free ticket for this draw" });
      }
    }

    // Insert a row into pending_tickets (row-per-credit model)
    // NOTE: your table requires `source` NOT NULL → set 'tweet'.
    const insertRow = {
      wallet,
      draw_id: drawId,                 // nullable is fine if no draw
      source: "tweet",                 // <— important (fixes your NULL error)
      is_redeemed: false,
      is_consumed: false,
      created_at: new Date().toISOString(),
    };

    const { error: ie } = await supabase.from("pending_tickets").insert(insertRow);
    if (ie) return res.status(500).json({ ok:false, error: ie.message });

    return res.status(200).json({ ok:true, credited: 1 });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}

