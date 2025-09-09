import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: ISO string (UTC) for N days ago
function daysAgoISO(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const wallet = (req.query.wallet || "").trim();
    if (!wallet) return res.status(400).json({ ok: false, error: "Missing wallet" });

    // 1) Get the latest draw_date (your schema’s column name)
    const { data: lastDraw, error: drawErr } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawErr) {
      return res.status(500).json({ ok: false, error: `draws query: ${drawErr.message}` });
    }

    // Defensive window:
    // - If there IS a draw_date and it's not in the future → start from that.
    // - If draw_date is in the future (bad clock / manual insert) → use 14 days lookback.
    // - If there is NO draw yet → 14 days lookback.
    const nowIso = new Date().toISOString();
    const latestDrawIso = lastDraw?.draw_date || null;
    const drawIsFuture = latestDrawIso ? new Date(latestDrawIso).getTime() > Date.now() : false;

    const windowStartIso = (!latestDrawIso || drawIsFuture)
      ? daysAgoISO(14)                 // fallback window
      : latestDrawIso;                 // normal: since last draw
    const windowEndIso = nowIso;

    // 2) Entries for this wallet within the window
    const { data: entries, error: entErr } = await supabase
      .from("entries")
      .select("id, created_at, num1, num2, num3, num4, moonball, entry_type")
      .eq("wallet", wallet)
      .gte("created_at", windowStartIso)
      .lte("created_at", windowEndIso)
      .order("created_at", { ascending: false })
      .limit(200);

    if (entErr) {
      return res.status(500).json({ ok: false, error: `entries query: ${entErr.message}` });
    }

    // 3) If still empty, return last 10 tickets (unfiltered) so the UI can show *something*
    let fallback = [];
    if (!entries || entries.length === 0) {
      const { data: last10 } = await supabase
        .from("entries")
        .select("id, created_at, num1, num2, num3, num4, moonball, entry_type")
        .eq("wallet", wallet)
        .order("created_at", { ascending: false })
        .limit(10);
      fallback = last10 || [];
    }

    return res.status(200).json({
      ok: true,
      items: entries || [],
      meta: {
        windowStart: windowStartIso,
        windowEnd: windowEndIso,
        latestDrawIso: latestDrawIso,
        drawIsFuture,
        fallbackUsed: (entries || []).length === 0,
        fallbackItems: fallback
      }
    });
  } catch (e) {
    console.error("myTickets error:", e);
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
}
