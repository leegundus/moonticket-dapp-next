import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try {
    const { wallet, tweetUrl } = req.body || {};
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });
    if (!tweetUrl || !isValidTweetUrl(tweetUrl)) {
      return res.status(400).json({ ok:false, error:"Valid X/Twitter status URL required" });
    }

    // latest draw -> need ID for free_claims
    const { data: lastDraw, error: ldErr } = await supabase
      .from("draws").select("id, draw_date").order("draw_date", { ascending:false }).limit(1).maybeSingle();
    if (ldErr) return res.status(500).json({ ok:false, error: ldErr.message });
    if (!lastDraw?.id) return res.status(500).json({ ok:false, error:"No draw scheduled yet" });

    // one claim per draw (unique on wallet, draw_id)
    const { error: fcErr } = await supabase
      .from("free_claims")
      .insert({ wallet, draw_id: lastDraw.id });
    if (fcErr) {
      if (fcErr.code === "23505") {
        return res.status(409).json({ ok:false, error:"Already claimed free ticket for this drawing." });
      }
      return res.status(500).json({ ok:false, error: fcErr.message });
    }

    // credit +1 (ensure source not null on first insert)
    // Try RPC if you have it; otherwise fallback to select+insert/update
    let upErr = null;
    try {
      const { error } = await supabase.rpc("exec_sql", {
        q: `
          INSERT INTO public.pending_tickets (wallet, balance, source, updated_at)
          VALUES ($1, 1, 'free_tweet', now())
          ON CONFLICT (wallet)
          DO UPDATE SET balance = public.pending_tickets.balance + 1, updated_at = now();
        `,
        params: [wallet],
      });
      upErr = error || null;
    } catch (e) {
      upErr = e;
    }
    if (upErr) {
      // fallback path
      const { data: row, error: selErr } = await supabase
        .from("pending_tickets").select("balance").eq("wallet", wallet).maybeSingle();
      if (selErr) return res.status(500).json({ ok:false, error: selErr.message });

      if (!row) {
        const { error: insErr } = await supabase
          .from("pending_tickets")
          .insert({ wallet, balance: 1, source: "free_tweet", updated_at: new Date().toISOString() });
        if (insErr) return res.status(500).json({ ok:false, error: insErr.message });
      } else {
        const { error: updErr } = await supabase
          .from("pending_tickets")
          .update({ balance: Number(row.balance || 0) + 1, updated_at: new Date().toISOString() })
          .eq("wallet", wallet);
        if (updErr) return res.status(500).json({ ok:false, error: updErr.message });
      }
    }

    // return fresh balance
    const { data: fresh, error: freshErr } = await supabase
      .from("pending_tickets").select("balance").eq("wallet", wallet).maybeSingle();
    if (freshErr) return res.status(200).json({ ok:true, credited:1 });

    return res.status(200).json({ ok:true, credited:1, newBalance:Number(fresh?.balance || 0) });
  } catch (e) {
    console.error("claimFreeTicket error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
