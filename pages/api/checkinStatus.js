import { supabaseRest } from "../../lib/supabaseRestServer";
import { centralDateKey, dateKeyDiff, rewardForStreak } from "../../lib/dailyStreak";

function validWallet(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const wallet = String(req.query?.wallet || "").trim();
  if (!validWallet(wallet)) {
    return res.status(400).json({ error: "Invalid Solana wallet" });
  }

  try {
    const q = new URLSearchParams({
      wallet: "eq." + wallet,
      select: "wallet,last_checkin,streak_count,pending_tix,lifetime_tix,last_reward_tix",
      limit: "1",
    });
    const rows = await supabaseRest("daily_checkins?" + q.toString());
    const row = Array.isArray(rows) ? rows[0] : null;

    if (!row) {
      return res.status(200).json({
        streak: 0,
        checkedInToday: false,
        nextStreakDay: 1,
        nextRewardTix: rewardForStreak(1),
        pendingTix: 0,
        lifetimeTix: 0,
        lastRewardTix: 0,
        lastCheckin: null,
      });
    }

    const todayKey = centralDateKey();
    const lastKey = centralDateKey(new Date(row.last_checkin));
    const daysSince = dateKeyDiff(todayKey, lastKey);
    const storedStreak = Math.min(Math.max(Number(row.streak_count || 0), 0), 7);
    const checkedInToday = daysSince === 0;
    const activeStreak = daysSince <= 1 ? storedStreak : 0;
    const nextStreakDay = checkedInToday
      ? activeStreak
      : daysSince === 1
        ? Math.min(activeStreak + 1, 7)
        : 1;

    return res.status(200).json({
      streak: activeStreak,
      checkedInToday,
      nextStreakDay,
      nextRewardTix: rewardForStreak(Math.max(nextStreakDay, 1)),
      pendingTix: Number(row.pending_tix || 0),
      lifetimeTix: Number(row.lifetime_tix || 0),
      lastRewardTix: Number(row.last_reward_tix || 0),
      lastCheckin: row.last_checkin,
    });
  } catch (err) {
    console.error("Daily TIX status error:", err?.message, err?.details || "");
    return res.status(500).json({ error: "Could not load daily streak." });
  }
}
