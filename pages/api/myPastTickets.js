import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const { wallet, page = 1, limit = 10, window } = req.query;
    if (!wallet) return res.status(400).json({ error: "wallet required" });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ------------------------------------------------------------
    // 1) Determine the window
    //    - "last": tickets created >= prev_draw.draw_date AND < last_draw.draw_date
    // ------------------------------------------------------------
    let startIso = null, endIso = null;
    let jackpotSolEach = 0; // SOL per jackpot winner for the last draw (if any)

    if (window === "last") {
      const { data: draws, error: dErr } = await supabase
        .from("draws")
        .select("id, draw_date, jackpot_sol")
        .order("draw_date", { ascending: false })
        .limit(2);

      if (dErr) throw dErr;

      const last = draws?.[0] || null;
      const prev = draws?.[1] || null;

      // If we don't have two draws yet, there's no "last window" to show
      if (!last || !prev) {
        return res.json({ items: [], total: 0 });
      }

      startIso = new Date(prev.draw_date).toISOString(); // inclusive
      endIso   = new Date(last.draw_date).toISOString(); // exclusive

      // Compute jackpot SOL/share for the last draw (80% pool snapshot in draw.jackpot_sol)
      // Count jackpot winner rows using count=exact + head=true (data null, count present)
      const { error: wErr, count: jpCount } = await supabase
        .from("prize_awards")
        .select("id", { count: "exact", head: true })
        .eq("draw_id", last.id)
        .eq("tier", "JACKPOT");
      if (wErr) throw wErr;

      const jackpotCount = Number(jpCount || 0);
      const jackpotSolTotal = Number(last.jackpot_sol || 0); // already in SOL units
      jackpotSolEach = jackpotCount > 0 ? jackpotSolTotal / jackpotCount : 0;
    }

    // ------------------------------------------------------------
    // 2) Base ticket query for this wallet (windowed if provided)
    // ------------------------------------------------------------
    const from = (Number(page) - 1) * Number(limit);
    const to   = Number(page) * Number(limit) - 1;

    let q = supabase
      .from("entries")
      .select("id, created_at, num1, num2, num3, num4, moonball", { count: "exact" })
      .eq("wallet", wallet)
      .not("num1", "is", null).not("num2", "is", null)
      .not("num3", "is", null).not("num4", "is", null)
      .not("moonball", "is", null);

    if (startIso && endIso) {
      q = q.gte("created_at", startIso).lt("created_at", endIso);
    }

    q = q.order("created_at", { ascending: false }).range(from, to);

    const { data: tickets, error: tErr, count } = await q;
    if (tErr) throw tErr;

    if (!tickets?.length) {
      return res.json({ items: [], total: count || 0 });
    }

    // ------------------------------------------------------------
    // 3) Pull prize rows for these tickets
    // ------------------------------------------------------------
    const ids = tickets.map(t => t.id);
    const { data: awards, error: aErr } = await supabase
      .from("prize_awards")
      .select("entry_id, tier, payout_tix, tx_sig");
    // NOTE: no time filter here—just match these entry_ids.
    // If you want to be extra strict, add `.in("entry_id", ids)`
    // (some Supabase versions require it on a separate line for type inference).
    if (aErr) throw aErr;

    const byEntry = new Map(
      (awards || []).filter(a => ids.includes(a.entry_id)).map(a => [a.entry_id, a])
    );

    // ------------------------------------------------------------
    // 4) Build response with prize info
    //    - Jackpot => show SOL amount per winner (jackpotSolEach) and tier
    //    - Secondary => convert payout_tix base units (1e6) to human
    // ------------------------------------------------------------
    const items = tickets.map(t => {
      const a = byEntry.get(t.id);
      let prize_tix = 0, prize_sol = 0, prize_tier = null, tx_sig = null;

      if (a) {
        prize_tier = a.tier || null;
        tx_sig = a.tx_sig || null;
        if (a.tier === "JACKPOT") {
          prize_sol = jackpotSolEach;     // SOL per winner for that draw
          prize_tix = 0;
        } else {
          prize_tix = a.payout_tix ? Number(a.payout_tix) / 1_000_000 : 0;
          prize_sol = 0;
        }
      }

      return { ...t, prize_tier, prize_tix, prize_sol, tx_sig };
    });

    return res.json({ items, total: count ?? items.length });
  } catch (e) {
    console.error("mypastTickets error:", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

