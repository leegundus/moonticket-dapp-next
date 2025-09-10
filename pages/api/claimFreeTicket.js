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

    // Get the most recent draw_date to form the current "window".
    const { data: lastDraw, error: drawErr } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawErr) return res.status(500).json({ ok:false, error: drawErr.message });

    // If no past draws, treat windowStart very old so a claim is allowed.
    const windowStart = lastDraw?.draw_date || "1970-01-01T00:00:00Z";

    // Enforce one claim per wallet per draw window by logging a row in `entries`.
    // We DO NOT create a ticket; we just record the claim event.
    const { data: prior, error: priorErr } = await supabase
      .from("entries")
      .select("id")
      .eq("wallet", wallet)
      .eq("entry_type", "free_claim")
      .gte("created_at", windowStart)
      .limit(1);

    if (priorErr) return res.status(500).json({ ok:false, error: priorErr.message });
    if (prior && prior.length > 0) {
      return res.status(200).json({ ok:false, error: "Already claimed free ticket for this drawing" });
    }

    // Upsert/increment the aggregate pending credits for this wallet.
    const { data: row, error: getErr } = await supabase
      .from("pending_tickets")
      .select("balance")
      .eq("wallet", wallet)
      .maybeSingle();

    if (getErr) return res.status(500).json({ ok:false, error: getErr.message });

    if (row) {
      const { error: upErr } = await supabase
        .from("pending_tickets")
        .update({ balance: (row.balance || 0) + 1, updated_at: new Date().toISOString() })
        .eq("wallet", wallet);
      if (upErr) return res.status(500).json({ ok:false, error: upErr.message });
    } else {
      const { error: insErr } = await supabase
        .from("pending_tickets")
        .insert({ wallet, balance: 1, updated_at: new Date().toISOString() });
      if (insErr) return res.status(500).json({ ok:false, error: insErr.message });
    }

    // Log the claim (for anti-abuse + window check). Numbers are NULL; entry_type distinguishes it.
    const { error: logErr } = await supabase.from("entries").insert({
      wallet,
      entry_type: "free_claim",
      // no numbers; just auditing the claim time
    });
    if (logErr) return res.status(500).json({ ok:false, error: logErr.message });

    return res.status(200).json({ ok:true });
  } catch (e) {
    console.error("claimFreeTicket error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
