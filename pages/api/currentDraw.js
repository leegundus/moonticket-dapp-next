import { getDrawWindow } from "../../lib/weeklyDraw";
import { ensureWeeklyDraw } from "../../lib/supabaseRestServer";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { start, end, drawKey } = getDrawWindow();
    const draw = await ensureWeeklyDraw({ drawKey, drawDate: end.toISOString() });
    return res.status(200).json({
      draw: draw || null,
      window: { start: start.toISOString(), end: end.toISOString(), drawKey },
    });
  } catch (err) {
    console.error("currentDraw error:", err?.message, err?.details || "");
    return res.status(500).json({ error: "Could not load this week's drawing." });
  }
}
