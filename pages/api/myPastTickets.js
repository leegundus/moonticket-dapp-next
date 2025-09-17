import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY!;

const PAGE_SIZE_MAX = 50;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const wallet = String(req.query.wallet || "").trim();
    if (!wallet) return res.status(400).json({ error: "wallet required" });

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limitRaw = parseInt(String(req.query.limit || "10"), 10) || 10;
    const limit = Math.min(Math.max(1, limitRaw), PAGE_SIZE_MAX);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const windowSel = String(req.query.window || "").toLowerCase(); // expect "last"
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Get last two draws
    const { data: draws, error: drawsErr } = await supabase
      .from("draws")
      .select("id, draw_date")
      .order("draw_date", { ascending: false })
      .limit(2);

    if (drawsErr) throw drawsErr;

    const mostRecent = draws?.[0];
    const secondMost = draws?.[1];

    // Compute window
    let windowStartISO: string | null = null;
    let windowEndISO: string | null = null;
    let scoringDrawId: number | null = null;

    if (windowSel === "last" && mostRecent?.draw_date && secondMost?.draw_date) {
      // Last-draw window: [secondMost, mostRecent)
      windowStartISO = new Date(secondMost.draw_date).toISOString();
      windowEndISO = new Date(mostRecent.draw_date).toISOString();
      scoringDrawId = mostRecent.id as number;
    } else if (mostRecent?.draw_date) {
      // Fallback: anything strictly before the most recent draw
      windowEndISO = new Date(mostRecent.draw_date).toISOString();
      scoringDrawId = mostRecent.id as number;
    } else {
      // No draws yet → nothing to return
      return res.status(200).json({ items: [], total: 0 });
    }

    // Base query
    let q = supabase
      .from("entries")
      .select("id,wallet,num1,num2,num3,num4,moonball,created_at", { count: "exact" })
      .eq("wallet", wallet)
      .not("num1", "is", null)
      .not("num2", "is", null)
      .not("num3", "is", null)
      .not("num4", "is", null)
      .not("moonball", "is", null)
      .order("created_at", { ascending: false });

    if (windowStartISO) q = q.gte("created_at", windowStartISO);
    if (windowEndISO)   q = q.lt("created_at", windowEndISO);

    const { data: items, error: entErr, count } = await q.range(from, to);
    if (entErr) throw entErr;

    // Attach prize info from the draw that scored this window (the most recent draw)
    let byId: Record<string, any> = {};
    (items || []).forEach((t) => { byId[t.id] = { ...t }; });

    if (items && items.length && scoringDrawId != null) {
      const ids = items.map((t) => t.id);
      const { data: awards, error: awErr } = await supabase
        .from("prize_awards")
        .select("entry_id,tier,payout_tix,tx_sig")
        .eq("draw_id", scoringDrawId)
        .in("entry_id", ids);

      if (awErr) throw awErr;

      for (const a of awards || []) {
        const row = byId[a.entry_id];
        if (!row) continue;
        // convert base units string -> human TIX number
        let humanTix = 0;
        if (a.payout_tix) {
          try {
            const n = BigInt(a.payout_tix as any);
            humanTix = Number(n) / 1_000_000; // TIX has 6 decimals
          } catch {}
        }
        row.prize_tix = humanTix > 0 ? humanTix : 0; // number
        row.prize_tier = a.tier || null;
        row.tx_sig = a.tx_sig || null;
        // NOTE: jackpot (SOL) amount isn’t stored; frontend will show "WIN" for TIX only.
      }
    }

    const enriched = Object.values(byId);

    return res.status(200).json({
      items: enriched,
      total: count || 0,
      windowStart: windowStartISO,
      windowEnd: windowEndISO,
      scoringDrawId,
    });
  } catch (e: any) {
    console.error("mypastTickets error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
