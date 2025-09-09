import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok:false, error: "Method not allowed" });
  }

  try {
    const wallet = req.query.wallet;
    if (!wallet) return res.status(400).json({ ok:false, error: "Missing wallet" });

    // latest/active draw
    const { data: lastDraw, error: drawErr } = await supabase
      .from("draws")
      .select("id, draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawErr) return res.status(500).json({ ok:false, error: drawErr.message });
    if (!lastDraw?.id) return res.status(200).json({ ok:true, drawId: null, drawDate: null, tickets: [] });

    // entries for this wallet & draw
    const { data: entries, error: entErr } = await supabase
      .from("entries")
      .select("id, num1, num2, num3, num4, moonball, entry_type, created_at")
      .eq("wallet", wallet)
      .eq("draw_id", lastDraw.id)
      .order("created_at", { ascending: false });

    if (entErr) return res.status(500).json({ ok:false, error: entErr.message });

    return res.status(200).json({
      ok: true,
      drawId: lastDraw.id,
      drawDate: lastDraw.draw_date,
      tickets: entries || []
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
