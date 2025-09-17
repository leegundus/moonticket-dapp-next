import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,                // server var (NOT next_public)
  process.env.SUPABASE_SERVICE_ROLE_KEY    // server var (service role, server only)
);

export default async function handler(req, res) {
  try {
    const { wallet, page = "1", pageSize = "10" } = req.query;
    if (!wallet) return res.status(400).json({ error: "Missing wallet" });

    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10));
    const from = (p - 1) * ps;
    const to = from + ps - 1;

    // 1) Find the most recent draw (cutoff)
    const { data: lastDraw, error: drawErr } = await supabase
      .from("draws")
      .select("id, draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .single();

    if (drawErr) throw drawErr;

    // If no draws yet, there are no "past" tickets by definition
    if (!lastDraw?.draw_date) {
      return res.status(200).json({
        items: [],
        total: 0,
        page: p,
        pageSize: ps,
        cutoff: null,
      });
    }

    const cutoffIso = new Date(lastDraw.draw_date).toISOString();

    // 2) Tickets strictly BEFORE the last draw time (i.e., truly past)
    const baseFilter = supabase
      .from("entries")
      .select("id,wallet,entry_type,num1,num2,num3,num4,moonball,created_at", { count: "exact" })
      .eq("wallet", wallet)
      .lt("created_at", cutoffIso)        // 🔑 past: older than last draw
      .not("num1", "is", null)
      .not("num2", "is", null)
      .not("num3", "is", null)
      .not("num4", "is", null)
      .not("moonball", "is", null)
      .order("created_at", { ascending: false });

    // Get page of rows
    const { data: items, error: itemsErr, count } = await baseFilter.range(from, to);
    if (itemsErr) throw itemsErr;

    return res.status(200).json({
      items: items ?? [],
      total: count ?? 0,
      page: p,
      pageSize: ps,
      cutoff: cutoffIso,
    });
  } catch (e) {
    console.error("myPastTickets error:", e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
