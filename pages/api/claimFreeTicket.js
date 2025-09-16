import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// basic, strict-enough validator for X/Twitter status URLs
function isValidTweetUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    const allowed = ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"];
    if (!allowed.includes(host)) return false;
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

    // 1) Latest draw
    const { data: lastDraw, error: ldErr } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ldErr) return res.status(500).json({ ok: false, error: ldErr.message });
    if (!lastDraw?.draw_date) {
      return res.status(500).json({ ok: false, error: "No draw scheduled yet" });
    }
    const drawDate = lastDraw.draw_date;

    // 2) Enforce one claim per draw using unique (wallet, draw_date)
    const { error: fcErr } = await supabase
      .from("free_claims")
      .insert({ wallet, draw_date: drawDate });

    if (fcErr) {
      // 23505 = unique_violation
      if (fcErr.code === "23505") {
        return res.status(409).json({ ok: false, error: "Already claimed free ticket for this drawing." });
      }
      return res.status(500).json({ ok: false, error: fcErr.message });
    }

    // 3) Credit +1 in pending_tickets (set source on insert to satisfy NOT NULL)
    //    We keep a single row per wallet. On conflict, just add to balance.
    const { error: upErr } = await supabase.rpc("exec_sql", {
      // Use a tiny RPC if you already have it; otherwise do two round-trips below.
      // If you DON'T have exec_sql in your DB, comment this block and use the fallback code that follows.
      q: `
        INSERT INTO public.pending_tickets (wallet, balance, source, updated_at)
        VALUES ($1, 1, 'free_tweet', now())
        ON CONFLICT (wallet)
        DO UPDATE SET balance = public.pending_tickets.balance + 1, updated_at = now();
      `,
      params: [wallet],
    });

    if (upErr?.message?.includes("function public.exec_sql") || upErr?.code === "42883") {
      // ---- Fallback: plain Supabase upsert in two steps (for setups without exec_sql) ----
      const { data: row, error: selErr } = await supabase
        .from("pending_tickets")
        .select("wallet,balance")
        .eq("wallet", wallet)
        .maybeSingle();

      if (selErr) return res.status(500).json({ ok: false, error: selErr.message });

      if (!row) {
        // insert with a non-null source to avoid your previous NOT NULL error
        const { error: insErr } = await supabase
          .from("pending_tickets")
          .insert({ wallet, balance: 1, source: "free_tweet", updated_at: new Date().toISOString() });
        if (insErr) return res.status(500).json({ ok: false, error: insErr.message });
      } else {
        const { error: updErr } = await supabase
          .from("pending_tickets")
          .update({ balance: (Number(row.balance) || 0) + 1, updated_at: new Date().toISOString() })
          .eq("wallet", wallet);
        if (updErr) return res.status(500).json({ ok: false, error: updErr.message });
      }
    } else if (upErr) {
      return res.status(500).json({ ok: false, error: upErr.message });
    }

    // 4) (Optional) try to write a ledger row if you have that table; ignore if it doesn't exist
    try {
      await supabase.from("pending_ticket_ledger").insert({
        wallet,
        delta: 1,
        source: "free_tweet",
        draw_date: drawDate,
        meta: { tweet_url: null }, // you said not to store tweet URLs
      });
    } catch {}

    // 5) Return fresh balance for convenience
    const { data: fresh, error: freshErr } = await supabase
      .from("pending_tickets")
      .select("balance")
      .eq("wallet", wallet)
      .maybeSingle();

    if (freshErr) {
      return res.status(200).json({ ok: true, credited: 1 });
    }

    return res.status(200).json({ ok: true, credited: 1, newBalance: Number(fresh?.balance || 0) });
  } catch (e) {
    console.error("claimFreeTicket error:", e);
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
}
