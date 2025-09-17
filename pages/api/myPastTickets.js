/* eslint-disable no-console */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side only

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  try {
    const wallet = String(req.query.wallet || "").trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize || "10", 10)));

    if (!wallet) {
      return res.status(400).json({ ok: false, error: "wallet is required" });
    }

    // 1) Find the MOST RECENT draw time
    const { data: lastDraw, error: drawErr } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawErr) {
      console.error(drawErr);
      return res.status(500).json({ ok: false, error: "Failed to load draws" });
    }

    // If no prior draw exists, there are no "past" tickets yet
    if (!lastDraw?.draw_date) {
      return res.status(200).json({ ok: true, items: [], total: 0, page, pageSize });
    }

    const cutoffIso = new Date(lastDraw.draw_date).toISOString(); // trusted server time

    // 2) Count past tickets (created strictly BEFORE the last draw)
    const baseSel =
      "id,num1,num2,num3,num4,moonball,created_at"; // keep payload small

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from("entries")
      .select(baseSel, { count: "exact" })
      .eq("wallet", wallet)
      .lt("created_at", cutoffIso)        // <-- strict past tickets only
      .not("num1", "is", null)
      .not("num2", "is", null)
      .not("num3", "is", null)
      .not("num4", "is", null)
      .not("moonball", "is", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error(error);
      return res.status(500).json({ ok: false, error: "Failed to load past tickets" });
    }

    return res.status(200).json({
      ok: true,
      items: data || [],
      total: count ?? (data ? data.length : 0),
      page,
      pageSize,
      cutoff: cutoffIso, // helpful for debugging
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
