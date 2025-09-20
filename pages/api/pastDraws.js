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

  // Fast path for exact matches
  if (CANON_TIERS.includes(t)) return t;

  // Case-insensitive handling (e.g. "JACKPOT" -> "jackpot")
  const upper = t.toUpperCase();

  if (upper === "JACKPOT") return "jackpot";

  // Normalize variants like "3 + MB", "3+mb", "3 +mb", etc.
  const compact = upper.replace(/\s+/g, "");
  const plusMbMatch = compact.match(/^([0-4])\+MB$/); // "0+MB" ... "4+MB"
  if (plusMbMatch) {
    const n = plusMbMatch[1];
    if (n === "0") return "0+MB";
    if (n === "1") return "1+MB";
    if (n === "2") return "2+MB";
    if (n === "3") return "3+MB";
    if (n === "4") return "jackpot"; // treat 4+MB as Jackpot
  }

  // Pure number tiers like "4" or "3"
  if (/^[0-4]$/.test(t)) return t;

  // Unknown label — ignore it
  return null;
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

    // 2) Fetch prize_awards for those draws
    const drawIds = draws.map((d) => d.id);
    const { data: awards, error: awardsErr } = await supabase
      .from("prize_awards")
      .select("draw_id,tier")
      .in("draw_id", drawIds);

    if (awardsErr) {
      console.error("pastDraws: awardsErr", awardsErr);
    }

    // 3) Group counts by draw_id with normalized tier keys
    const countsByDraw = new Map();
    if (awards?.length) {
      for (const row of awards) {
        const k = row.draw_id;
        const norm = normalizeTier(row.tier);
        if (!norm) continue; // skip unknown labels
        if (!countsByDraw.has(k)) countsByDraw.set(k, {});
        const bucket = countsByDraw.get(k);
        bucket[norm] = (bucket[norm] || 0) + 1;
      }
    }

    // 4) Shape response with guaranteed presence of all tiers
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
        winner: d.winner || null, // legacy single-winner field if you still use it
        winning_numbers: { nums, moonball },
        tierCounts, // { jackpot, "4", "3+MB", "3", "2+MB", "1+MB", "0+MB" }
      };
    });

    return res.status(200).json({ items });
  } catch (e) {
    console.error("pastDraws handler error:", e);
    return res.status(500).json({ error: "Server error" });
  }
}
