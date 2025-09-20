import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // service key preferred
const supabase = createClient(supabaseUrl, supabaseKey);

// tiers we care about + the display keys your UI expects
const TIER_KEYS = ["jackpot", "4", "3+MB", "3", "2+MB", "1+MB", "0+MB"];

export default async function handler(req, res) {
  try {
    // 1) fetch draws (newest first)
    const { data: draws, error: drawsErr } = await supabase
      .from("draws")
      .select(
        `
          id,
          draw_date,
          winner,
          jackpot_sol,
          entries,
          rolled_over,
          tx_signature,
          win_num1,
          win_num2,
          win_num3,
          win_num4,
          win_moonball
        `
      )
      .order("draw_date", { ascending: false })
      .limit(50);

    if (drawsErr) throw drawsErr;

    // 2) For each draw, aggregate winners by tier from prize_awards
    const results = [];
    for (const d of draws || []) {
      // group counts by "tier"
      const { data: grouped, error: gErr } = await supabase
        .from("prize_awards")
        .select("tier, count:count()", { head: false })
        .eq("draw_id", d.id)
        .group("tier");

      if (gErr) throw gErr;

      // normalize into an object for easy lookup in the UI
      const winners_by_tier = Object.fromEntries(
        TIER_KEYS.map((k) => {
          const row = (grouped || []).find((r) => r.tier === k);
          return [k, row ? Number(row.count || 0) : 0];
        })
      );

      results.push({
        id: d.id,
        draw_date: d.draw_date,
        winner: d.winner,
        jackpot_sol: Number(d.jackpot_sol || 0),
        entries: Number(d.entries || 0),
        rolled_over: !!d.rolled_over,
        tx_signature: d.tx_signature || null,
        // winning numbers in a predictable shape the UI understands
        winning_numbers: {
          nums: [d.win_num1, d.win_num2, d.win_num3, d.win_num4].filter(
            (x) => typeof x === "number"
          ),
          moonball: typeof d.win_moonball === "number" ? d.win_moonball : null,
        },
        winners_by_tier,
      });
    }

    res.status(200).json(results);
  } catch (e) {
    console.error("pastDraws API error:", e);
    res.status(500).json({ error: e.message || "Failed to load past draws" });
  }
}
