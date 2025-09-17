/* eslint-disable no-console */
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { wallet, page = "1", pageSize = "10" } = req.query;
    if (!wallet) return res.status(400).json({ error: "Missing wallet" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: "Server not configured" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1) Find the most recent draw_date
    const { data: lastDraw, error: drawErr } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawErr) throw drawErr;
    if (!lastDraw?.draw_date) {
      // If no draws yet, there are no "past" tickets by definition
      return res.status(200).json({ items: [], page: Number(page), pageSize: Number(pageSize), total: 0 });
    }

    const cutoff = new Date(lastDraw.draw_date).toISOString();

    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10));
    const from = (p - 1) * ps;
    const to = from + ps - 1;

    // 2) Count total (for pagination UI)
    const { count: total, error: countErr } = await supabase
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("wallet", wallet)
      .lt("created_at", cutoff)
      .not("num1", "is", null)
      .not("num2", "is", null)
      .not("num3", "is", null)
      .not("num4", "is", null)
      .not("moonball", "is", null);

    if (countErr) throw countErr;

    // 3) Page of items
    const { data: items, error: listErr } = await supabase
      .from("entries")
      .select("id,created_at,num1,num2,num3,num4,moonball")
      .eq("wallet", wallet)
      .lt("created_at", cutoff)
      .not("num1", "is", null)
      .not("num2", "is", null)
      .not("num3", "is", null)
      .not("num4", "is", null)
      .not("moonball", "is", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (listErr) throw listErr;

    return res.status(200).json({ items: items || [], page: p, pageSize: ps, total: total || 0 });
  } catch (e) {
    console.error("myPastTickets error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
