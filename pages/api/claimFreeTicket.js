import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isValidTweetUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    const ok = ["x.com","www.x.com","twitter.com","www.twitter.com","mobile.twitter.com"];
    if (!ok.includes(host)) return false;
    // /<handle>/status/<id>
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
    if (!tweetUrl || !isValidTweetUrl(tweetUrl)) {
      return res.status(400).json({ ok:false, error:"Valid X/Twitter status URL required" });
    }

    // Get the start of the current draw window
    const { data: lastDraw, error: de } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (de) return res.status(500).json({ ok:false, error: de.message });
    const drawStart = lastDraw?.draw_date || null;

    // Ensure a balance row exists
    const { error: upsertErr } = await supabase
      .from("pending_tickets")
      .upsert({ wallet, balance: 0 }, { onConflict: "wallet" });
    if (upsertErr) return res.status(500).json({ ok:false, error: upsertErr.message });

    // Read current balance + last_free_draw
    const { data: row, error: readErr } = await supabase
      .from("pending_tickets")
      .select("balance,last_free_draw")
      .eq("wallet", wallet)
      .maybeSingle();
    if (readErr) return res.status(500).json({ ok:false, error: readErr.message });

    // If already claimed for this draw, block further claims
    if (drawStart && row?.last_free_draw && new Date(row.last_free_draw) >= new Date(drawStart)) {
      return res.status(409).json({
        ok: false,
        error: "Already claimed free ticket for this drawing"
      });
    }

    // Add +1 credit and stamp this draw as the last free claim
    const newBalance = Number(row?.balance || 0) + 1;
    const { data: upd, error: updErr } = await supabase
      .from("pending_tickets")
      .update({
        balance: newBalance,
        last_free_draw: drawStart || row?.last_free_draw || null,
        updated_at: new Date().toISOString()
      })
      .eq("wallet", wallet)
      .select("balance")
      .maybeSingle();
    if (updErr) return res.status(500).json({ ok:false, error: updErr.message });

    return res.status(200).json({
      ok: true,
      newBalance: Number(upd?.balance ?? newBalance),
      message: "Free ticket credited"
    });
  } catch (e) {
    console.error("claimFreeTicket error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
