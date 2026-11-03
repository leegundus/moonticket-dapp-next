import { getDrawWindow } from "../../lib/weeklyDraw";
import { ensureWeeklyDraw, supabaseRest } from "../../lib/supabaseRestServer";

function validWallet(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const wallet = String(req.body?.wallet || "").trim();
  if (!wallet) return res.status(400).json({ error: "Missing wallet" });
  if (!validWallet(wallet)) return res.status(400).json({ error: "Invalid Solana wallet" });

  try {
    const { start, end, drawKey } = getDrawWindow();
    await ensureWeeklyDraw({ drawKey, drawDate: end.toISOString() });

    const q = new URLSearchParams({
      select: "id",
      wallet: "eq." + wallet,
      entry_type: "eq.free",
      weekly_draw_key: "eq." + drawKey,
      limit: "1",
    });
    const existing = await supabaseRest("entries?" + q.toString());

    if (Array.isArray(existing) && existing.length) {
      return res.status(409).json({
        success: false,
        alreadyClaimed: true,
        error: "You are already entered in this week's drawing.",
      });
    }

    try {
      await supabaseRest("entries", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify([{
          wallet,
          entry_type: "free",
          entries: 1,
          tix_amount: 0,
          is_bonus: false,
          draw_date: end.toISOString(),
          weekly_draw_key: drawKey,
        }]),
      });
    } catch (err) {
      if (err.status === 409) {
        return res.status(409).json({
          success: false,
          alreadyClaimed: true,
          error: "You are already entered in this week's drawing.",
        });
      }
      throw err;
    }

    return res.status(200).json({
      success: true,
      entries: 1,
      drawKey,
      drawWindow: { start: start.toISOString(), end: end.toISOString() },
    });
  } catch (err) {
    console.error("claimFreeEntry error:", err?.message, err?.details || "");
    return res.status(500).json({
      error: "Could not save your weekly entry.",
      code: "ENTRY_API_ERROR",
    });
  }
}
