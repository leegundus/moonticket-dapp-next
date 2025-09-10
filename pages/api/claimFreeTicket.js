import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// simple URL validator (we don't store the URL; just require a real X/Twitter status link)
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

    // --- find current draw window (uses draw_date column) ---
    const { data: lastDraw, error: drawErr } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawErr) {
      return res.status(500).json({ ok: false, error: drawErr.message });
    }
    const drawIso = lastDraw?.draw_date || null; // if null, we’ll still allow the credit

    // --- OPTIONAL per-draw gating via a log table (no break if table missing) ---
    // If you have a table like:
    //   free_claims (id bigint pk, wallet text, draw_date timestamptz)
    // add a unique index on (wallet, draw_date) to enforce 1 per draw.
    if (drawIso) {
      // First try a cheap select; if table doesn't exist, the error is caught and we skip gating.
      const { data: existingClaim, error: selErr } = await supabase
        .from("free_claims")
        .select("id")
        .eq("wallet", wallet)
        .eq("draw_date", drawIso)
        .maybeSingle();

      if (!selErr && existingClaim) {
        return res.status(400).json({ ok: false, error: "Already claimed free ticket for this drawing." });
      }
    }

    // --- upsert / increment credit balance in pending_tickets ---
    // We keep `source: 'tweet'` to satisfy NOT NULL or auditing.
    const { data: pt, error: getErr } = await supabase
      .from("pending_tickets")
      .select("id,balance")
      .eq("wallet", wallet)
      .maybeSingle();

    if (getErr) {
      return res.status(500).json({ ok: false, error: getErr.message });
    }

    let newBalance = 1;

    if (pt) {
      const { data: upd, error: updErr } = await supabase
        .from("pending_tickets")
        .update({
          balance: (pt.balance || 0) + 1,
          source: "tweet",
          updated_at: new Date().toISOString(),
        })
        .eq("id", pt.id)
        .select("balance")
        .single();

      if (updErr) return res.status(500).json({ ok: false, error: updErr.message });
      newBalance = upd?.balance ?? (pt.balance || 0) + 1;
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("pending_tickets")
        .insert({
          wallet,
          balance: 1,
          source: "tweet",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("balance")
        .single();

      if (insErr) return res.status(500).json({ ok: false, error: insErr.message });
      newBalance = ins?.balance ?? 1;
    }

    // --- write the optional claim log if table exists (ignore if not) ---
    if (drawIso) {
      const { error: logErr } = await supabase
        .from("free_claims")
        .insert({ wallet, draw_date: drawIso });

      // If the table doesn't exist or unique constraint blocks a dup, just surface a friendly message.
      if (logErr && !/relation "free_claims" does not exist/i.test(logErr.message)) {
        // If you added a UNIQUE(wallet, draw_date), duplicate insert will return 23505.
        if (logErr.code === "23505") {
          return res.status(400).json({ ok: false, error: "Already claimed free ticket for this drawing." });
        }
        // Otherwise don’t fail the credit, just include a soft warning.
        console.warn("free_claims log error:", logErr.message);
      }
    }

    return res.status(200).json({ ok: true, balance: newBalance });
  } catch (e) {
    console.error("claimFreeTicket error:", e);
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
}
