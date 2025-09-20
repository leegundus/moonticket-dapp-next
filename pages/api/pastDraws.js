import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  // Use service role on the server so we can aggregate safely.
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Canonical keys the frontend expects (order doesn't matter here)
const CANON_TIERS = ["jackpot", "4", "3+MB", "3", "2+MB", "1+MB", "0+MB"];

/** Normalize DB `tier` values to canonical keys the UI expects. */
function normalizeTier(tierRaw) {
  if (!tierRaw) return null;
  const t = String(tierRaw).trim();

  if (CANON_TIERS.includes(t)) return t;      // exact match (e.g., "3+MB")
  const upper = t.toUpperCase();
  if (upper === "JACKPOT") return "jackpot";  // "JACKPOT" → "jackpot"

  // Variants like "3 + MB", "3+mb", " 3 +mb "
  const compact = upper.replace(/\s+/g, "");
  const plusMbMatch = compact.match(/^([0-4])\+MB$/);
  if (plusMbMatch) {
    const n = plusMbMatch[1];
    if (n === "4") return "jackpot"; // treat 4+MB as Jackpot
    return `${n}+MB`;
  }

  // Pure numeric tiers like "4" or "3"
  if (/^[0-4]$/.test(t)) return t;

  return null; // unknown label
}

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

    // 2) Fetch prize_awards for those draws (include wallet + tx_sig so we can list jackpot winners)
    const drawIds = draws.map((d) => d.id);
    const { data: awards, error: awardsErr } = await supabase
      .from("prize_awards")
      .select("draw_id,tier,wallet,tx_sig")
      .in("draw_id", drawIds);

    if (awardsErr) {
      console.error("pastDraws: awardsErr", awardsErr);
    }

    // 3) Aggregate: counts by tier, and jackpot winners per draw
    const countsByDraw = new Map();      // draw_id -> { tierKey: count }
    const jpWinnersByDraw = new Map();   // draw_id -> [{ wallet, tx_sig }]

    if (Array.isArray(awards) && awards.length) {
      for (const row of awards) {
        const drawId = row.draw_id;
        const tierKey = normalizeTier(row.tier);
        if (!tierKey) continue;

        // counts
        if (!countsByDraw.has(drawId)) countsByDraw.set(drawId, {});
        const bucket = countsByDraw.get(drawId);
        bucket[tierKey] = (bucket[tierKey] || 0) + 1;

        // jackpot winners list
        if (tierKey === "jackpot") {
          if (!jpWinnersByDraw.has(drawId)) jpWinnersByDraw.set(drawId, []);
          jpWinnersByDraw.get(drawId).push({
            wallet: row.wallet || null,
            tx_sig: row.tx_sig || null,
          });
        }
      }
    }

    // 4) Shape response with all tiers guaranteed + jackpot_winners array
    const items = draws.map((d) => {
      const base = Object.fromEntries(CANON_TIERS.map((t) => [t, 0]));
      const found = countsByDraw.get(d.id) || {};
      const tierCounts = { ...base, ...found };

      const nums = [d.win_num1, d.win_num2, d.win_num3, d.win_num4].filter(
        (n) => typeof n === "number"
      );
      const moonball = typeof d.win_moonball === "number" ? d.win_moonball : null;

      return {
        id: d.id,
        draw_date: d.draw_date,
        jackpot_sol: Number(d.jackpot_sol || 0),
        entries: Number(d.entries || 0),
        rolled_over: !!d.rolled_over,
        tx_signature: d.tx_signature || null,
        winner: d.winner || null, // legacy single-address field (kept for backward compat)
        winning_numbers: { nums, moonball },
        tierCounts,                                // { jackpot, "4", "3+MB", "3", "2+MB", "1+MB", "0+MB" }
        jackpot_winners: jpWinnersByDraw.get(d.id) || [], // [{ wallet, tx_sig }]
      };
    });

    return res.status(200).json({ items });
  } catch (e) {
    console.error("pastDraws handler error:", e);
    return res.status(500).json({ error: "Server error" });
  }
}
