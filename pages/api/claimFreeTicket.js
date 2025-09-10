import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// very light URL guard (we don't store it)
function isValidTweetUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    const okHosts = ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"];
    if (!okHosts.includes(host)) return false;
    return /^\/[A-Za-z0-9_]{1,15}\/status\/\d+/.test(url.pathname);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { wallet, tweetUrl } = req.body || {};
    if (!wallet) return res.status(400).json({ ok: false, error: "Missing wallet" });
    if (!tweetUrl || !isValidTweetUrl(tweetUrl)) {
      return res.status(400).json({ ok: false, error: "Valid X/Twitter status URL required" });
    }

    // 1) Find the latest draw_date (defines the current claiming window)
    const { data: lastDraw, error: drawErr } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawErr) {
      return res.status(500).json({ ok: false, error: drawErr.message });
    }
    const drawDate = lastDraw?.draw_date || null;
    if (!drawDate) {
      // If there is no row yet, we can either block claims or allow one global claim.
      // Safer: block until a draw is defined.
      return res.status(400).json({ ok: false, error: "No active drawing yet" });
    }

    // 2) Has this wallet already claimed for this draw?
    const { data: existing, error: existErr } = await supabase
      .from("free_claims")
      .select("id")
      .eq("wallet", wallet)
      .eq("draw_date", drawDate)
      .maybeSingle();

    if (existErr) {
      return res.status(500).json({ ok: false, error: existErr.message });
    }
    if (existing) {
      return res.status(409).json({ ok: false, error: "Already claimed free ticket for this drawing" });
    }

    // 3) Credit +1 to pending_tickets (no RPC needed; simple upsert)
    const { data: balRow, error: balErr } = await supabase
      .from("pending_tickets")
      .select("balance")
      .eq("wallet", wallet)
      .maybeSingle();

    if (balErr) return res.status(500).json({ ok: false, error: balErr.message });

    const newBalance = (Number(balRow?.balance || 0) || 0) + 1;

    const { error: upErr } = await supabase
      .from("pending_tickets")
      .upsert({ wallet, balance: newBalance, updated_at: new Date().toISOString() });

    if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

    // 4) Record the claim (enforces rule on the DB via unique index too)
    const { error: logErr } = await supabase
      .from("free_claims")
      .insert({ wallet, draw_date: drawDate });

    // If the unique constraint caught a race, surface "already claimed".
    if (logErr) {
      const msg = logErr.message || "";
      if (msg.toLowerCase().includes("duplicate key")) {
        return res.status(409).json({ ok: false, error: "Already claimed free ticket for this drawing" });
      }
      return res.status(500).json({ ok: false, error: logErr.message });
    }

    return res.status(200).json({ ok: true, credited: 1, balance: newBalance });
  } catch (e) {
    console.error("claimFreeTicket error:", e);
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
}
