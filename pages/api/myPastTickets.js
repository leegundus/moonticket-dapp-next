import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { wallet, page = "1", pageSize = "10" } = req.query;
    if (!wallet) return res.status(400).json({ error: "Missing wallet" });

    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10));
    const from = (p - 1) * ps;
    const to = from + ps - 1;

    // Grab the two most-recent draws
    const { data: draws, error: drawsErr } = await supabase
      .from("draws")
      .select("id, draw_date")
      .order("draw_date", { ascending: false })
      .limit(2);

    if (drawsErr) throw drawsErr;

    if (!draws || draws.length === 0) {
      // No draws yet → nothing "past"
      return res.status(200).json({
        items: [],
        total: 0,
        page: p,
        pageSize: ps,
        window: { start: null, end: null }
      });
    }

    const lastDrawDate = new Date(draws[0].draw_date).toISOString();
    const prevDrawDate =
      draws.length > 1 ? new Date(draws[1].draw_date).toISOString() : null;

    // Base filter: wallet + valid numbers, most-recent first
    let query = supabase
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
      // strictly before the latest draw (so nothing from the current window)
      .lt("created_at", lastDrawDate)
      .order("created_at", { ascending: false });

    // If we know the previous draw, clamp the window to just that past period
    if (prevDrawDate) {
      query = query.gte("created_at", prevDrawDate);
    }

    const { data: items, error: itemsErr, count } = await query.range(from, to);
    if (itemsErr) throw itemsErr;

    return res.status(200).json({
      items: items ?? [],
      total: count ?? 0,
      page: p,
      pageSize: ps,
      window: { start: prevDrawDate, end: lastDrawDate }
    });
  } catch (e) {
    console.error("myPastTickets error:", e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
