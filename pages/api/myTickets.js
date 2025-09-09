import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // server-side key to bypass RLS for this read
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const wallet = (req.query.wallet || "").trim();
    if (!wallet) return res.status(400).json({ ok: false, error: "Missing wallet" });

    // Get most recent draw start (your schema uses draw_date)
    const { data: lastDraw, error: drawErr } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawErr) return res.status(500).json({ ok: false, error: drawErr.message });

    const sinceIso = lastDraw?.draw_date || "1970-01-01T00:00:00Z";

    // Fetch this wallet's entries since the last draw
    const { data: entries, error: entErr } = await supabase
      .from("entries")
      .select("id, created_at, num1, num2, num3, num4, moonball, entry_type")
      .eq("wallet", wallet)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(200);

    if (entErr) return res.status(500).json({ ok: false, error: entErr.message });

    return res.status(200).json({ ok: true, items: entries || [] });
  } catch (e) {
    console.error("myTickets error:", e);
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
}
