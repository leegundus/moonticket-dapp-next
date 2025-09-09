import { createClient } from "@supabase/supabase-js";

function isValidTweetUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    const ok = ["x.com","www.x.com","twitter.com","www.twitter.com","mobile.twitter.com"];
    if (!ok.includes(host)) return false;
    return /^\/[A-Za-z0-9_]{1,15}\/status\/\d+/.test(url.pathname);
  } catch { return false; }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try {
    const { wallet, tweetUrl } = req.body || {};
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });
    if (!tweetUrl || !isValidTweetUrl(tweetUrl)) {
      return res.status(400).json({ ok:false, error:"Valid X/Twitter status URL required" });
    }

    // latest draw start
    const { data: lastDraw, error: de } = await supabase
      .from("draws").select("draw_date").order("draw_date", { ascending:false }).limit(1).maybeSingle();
    if (de) return res.status(500).json({ ok:false, error: de.message });
    const drawStart = lastDraw?.draw_date || null;

    // ensure row exists
    await supabase.from("pending_tickets").upsert({ wallet, balance: 0 });

    // increment balance by 1 only if not already claimed this draw
    const { data, error } = await supabase.rpc("exec_sql", {
      q: `
        UPDATE public.pending_tickets
        SET balance = balance + 1, last_free_draw = COALESCE($2, last_free_draw), updated_at = now()
        WHERE wallet = $1
          AND ($2 IS NULL OR last_free_draw IS NULL OR last_free_draw < $2)
        RETURNING balance;
      `,
      params: [wallet, drawStart]
    });

    // If you don't have an exec_sql RPC, use supabase-js client with PostgREST filter (less atomic).
    // I kept RPC here for true atomicity. If you need, I’ll send you the tiny SQL to create exec_sql.

    if (error) return res.status(500).json({ ok:false, error: error.message });

    if (!data || data.length === 0) {
      return res.status(409).json({ ok:false, error:"Already claimed a free ticket this draw" });
    }

    return res.status(200).json({ ok:true, newBalance: data[0].balance });
  } catch (e) {
    console.error("claimFreeTicket error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
