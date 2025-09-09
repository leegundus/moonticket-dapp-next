import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Keep the URL check so users paste a real X/Twitter post
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

    // Latest draw (your schema uses draw_date)
    const { data: lastDraw, error: de } = await supabase
      .from("draws")
      .select("id, draw_date")
      .order("draw_date", { ascending:false })
      .limit(1)
      .maybeSingle();
    if (de) return res.status(500).json({ ok:false, error: de.message });

    const drawId = lastDraw?.id ?? null;
    if (!drawId) {
      return res.status(400).json({ ok:false, error:"No active draw found" });
    }

    // Prevent double-claim per draw using a unique log
    const { error: insLogErr } = await supabase
      .from("free_claims")
      .insert({ wallet, draw_id: drawId, created_at: new Date().toISOString() });

    if (insLogErr) {
      // unique violation means they already claimed
      if (insLogErr.code === "23505") {
        return res.status(200).json({ ok:false, error:"Already claimed free ticket for this draw" });
      }
      return res.status(500).json({ ok:false, error: insLogErr.message });
    }

    // Upsert balance row then increment by 1
    await supabase
      .from("pending_tickets")
      .upsert({ wallet, balance: 0 }, { onConflict: "wallet" });

    const { data: balRow, error: balErr } = await supabase
      .from("pending_tickets")
      .select("balance")
      .eq("wallet", wallet)
      .maybeSingle();

    if (balErr) return res.status(500).json({ ok:false, error: balErr.message });

    const current = Number(balRow?.balance || 0);
    const newBalance = current + 1;

    const { error: updErr } = await supabase
      .from("pending_tickets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("wallet", wallet);

    if (updErr) return res.status(500).json({ ok:false, error: updErr.message });

    return res.status(200).json({ ok:true, credited: 1, balance: newBalance });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}
