import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // never cache
  res.setHeader("Cache-Control", "no-store");

  try {
    const { wallet, page = "1", pageSize = "10" } = req.query;
    if (!wallet) return res.status(400).json({ error: "Missing wallet" });

    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10));
    const from = (p - 1) * ps;
    const to = from + ps - 1;

    // Get the most recent draw time
    const { data: lastDraw, error: drawErr } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawErr) throw drawErr;

    if (!lastDraw) {
      // No draws yet → nothing to show as "past"
      return res.status(200).json({
        items: [],
        total: 0,
        page: p,
        pageSize: ps,
        cutoff: null,
      });
    }

    const cutoff = lastDraw.draw_date; // use DB string directly (timestamptz-safe)

    // All tickets for this wallet created strictly BEFORE the last draw time
    const { data: items, error: itemsErr, count } = await supabase
      .from("entries")
      .select(
        "id,wallet,entry_type,num1,num2,num3,num4,moonball,created_at",
        { count: "exact" }
      )
      .eq("wallet", wallet)
      .not("num1", "is", null)
      .not("num2", "is", null)
      .not("num3", "is", null)
      .not("num4", "is", null)
      .not("moonball", "is", null)
      .lt("created_at", cutoff) // <-- core filter
      .order("created_at", { ascending: false })
      .range(from, to);

    if (itemsErr) throw itemsErr;

    return res.status(200).json({
      items: items ?? [],
      total: count ?? 0,
      page: p,
      pageSize: ps,
      cutoff, // for debugging if you want to display it
    });
  } catch (e) {
    console.error("myPastTickets error:", e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
