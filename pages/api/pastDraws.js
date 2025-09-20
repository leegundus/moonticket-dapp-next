import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  // Service role key recommended on the server so we can aggregate safely.
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));

    // 1) Fetch draws (newest first)
    const { data: draws, error: drawsErr } = await supabase
      .from("draws")
      .select(
        [
          "id",
          "draw_date",
          "jackpot_sol",
          "entries",
          "rolled_over",
          "tx_signature",
          "winner",
          "win_num1",
          "win_num2",
          "win_num3",
          "win_num4",
          "win_moonball",
        ].join(",")
      )
      .order("draw_date", { ascending: false })
      .limit(limit);

    if (drawsErr) {
      console.error("pastDraws: drawsErr", drawsErr);
      return res.status(500).json({ error: "Failed to load draws" });
    }

    if (!draws || !draws.length) {
      return res.status(200).json({ items: [] });
    }

    // 2) For all draw ids, get prize_awards grouped by tier
    const drawIds = draws.map((d) => d.id);

    const { data: awards, error: awardsErr } = await supabase
      .from("prize_awards")
      .select("draw_id,tier")
      .in("draw_id", drawIds);

    if (awardsErr) {
      console.error("pastDraws: awardsErr", awardsErr);
      // still return the draws without tier counts
    }

    // Group counts by draw_id + tier
    const countsByDraw = new Map();
    if (awards && awards.length) {
      for (const row of awards) {
        const k = row.draw_id;
        const t = row.tier; // expected values: "jackpot","4","3+MB","3","2+MB","1+MB","0+MB"
        if (!countsByDraw.has(k)) countsByDraw.set(k, {});
        const obj = countsByDraw.get(k);
        obj[t] = (obj[t] || 0) + 1;
      }
    }

    // 3) Shape response
    const items = draws.map((d) => {
      const tierCounts = countsByDraw.get(d.id) || {};
      const nums = [d.win_num1, d.win_num2, d.win_num3, d.win_num4].filter(
        (n) => typeof n === "number"
      );
      const moonball =
        typeof d.win_moonball === "number" ? d.win_moonball : null;

      return {
        id: d.id,
        draw_date: d.draw_date,
        jackpot_sol: Number(d.jackpot_sol || 0),
        entries: Number(d.entries || 0),
        rolled_over: !!d.rolled_over,
        tx_signature: d.tx_signature || null,
        winner: d.winner || null,
        winning_numbers: { nums, moonball },
        tierCounts, // { "jackpot": n, "4": n, "3+MB": n, ... }
      };
    });

    return res.status(200).json({ items });
  } catch (e) {
    console.error("pastDraws handler error:", e);
    return res.status(500).json({ error: "Server error" });
  }
}
