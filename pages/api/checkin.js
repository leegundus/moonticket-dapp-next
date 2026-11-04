import { supabaseRest } from "../../lib/supabaseRestServer";

function validWallet(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const wallet = String(req.body?.wallet || "").trim();
  if (!validWallet(wallet)) {
    return res.status(400).json({ error: "Invalid Solana wallet" });
  }

  try {
    const rows = await supabaseRest("rpc/claim_daily_tix_reward", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ p_wallet: wallet }),
    });

    const result = Array.isArray(rows) ? rows[0] : rows;
    if (!result) throw new Error("No reward result returned");

    return res.status(200).json({
      success: Boolean(result.success),
      alreadyCheckedIn: Boolean(result.already_checked_in),
      streak: Number(result.streak_day || 0),
      rewardTix: Number(result.reward_tix || 0),
      pendingTix: Number(result.pending_tix || 0),
      lifetimeTix: Number(result.lifetime_tix || 0),
      lastCheckin: result.last_checkin || null,
    });
  } catch (err) {
    console.error("Daily TIX check-in error:", err?.message, err?.details || "");
    return res.status(500).json({ error: "Could not complete daily check-in." });
  }
}
