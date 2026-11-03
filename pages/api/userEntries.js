import { getDrawWindow } from "../../lib/weeklyDraw";
import { supabaseRest } from "../../lib/supabaseRestServer";

function validWallet(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const wallet = String(req.query?.wallet || "").trim();
  if (!wallet) return res.status(400).json({ error: "Missing wallet parameter" });
  if (!validWallet(wallet)) return res.status(400).json({ error: "Invalid Solana wallet" });

  try {
    const { start, end, drawKey } = getDrawWindow();
    const q = new URLSearchParams({
      select: "id",
      wallet: "eq." + wallet,
      entry_type: "eq.free",
      weekly_draw_key: "eq." + drawKey,
      limit: "1",
    });
    const rows = await supabaseRest("entries?" + q.toString());
    const freeEntries = Array.isArray(rows) && rows.length ? 1 : 0;

    return res.status(200).json({
      freeEntries,
      weeklyEntries: freeEntries,
      hasFreeEntry: freeEntries === 1,
      drawKey,
      drawWindow: { start: start.toISOString(), end: end.toISOString() },
    });
  } catch (err) {
    console.error("userEntries error:", err?.message, err?.details || "");
    return res.status(500).json({ error: "Failed to fetch weekly entry." });
  }
}
