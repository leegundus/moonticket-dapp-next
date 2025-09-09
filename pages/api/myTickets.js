import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // server key so RLS won't hide rows
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const wallet = (req.query.wallet || "").trim();
    if (!wallet) return res.status(400).json({ ok: false, error: "Missing wallet" });

    // 1) Latest draw_date (your schema uses draw_date)
    const { data: lastDraw, error: drawErr } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawErr) {
      return res.status(500).json({ ok: false, error: drawErr.message });
    }

    const sinceIso = lastDraw?.draw_date || "1970-01-01T00:00:00Z";

    // 2) Tickets for the current drawing
    const { data: currentEntries, error: entErr } = await supabase
      .from("entries")
      .select("id, created_at, num1, num2, num3, num4, moonball, entry_type")
      .eq("wallet", wallet)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(200);

    if (entErr) {
      return res.status(500).json({ ok: false, error: entErr.message });
    }

    // 3) Helpful fallback for visibility:
    // If none matched the draw filter, also return the last few tickets (unfiltered)
    // so the UI can still show *something* while we verify draw_date vs created_at.
    let fallback = [];
    if (!currentEntries || currentEntries.length === 0) {
      const { data: lastEntries } = await supabase
        .from("entries")
        .select("id, created_at, num1, num2, num3, num4, moonball, entry_type")
        .eq("wallet", wallet)
        .order("created_at", { ascending: false })
        .limit(10);
      fallback = lastEntries || [];
    }

    return res.status(200).json({
      ok: true,
      items: currentEntries || [],
      meta: {
        sinceDraw: sinceIso,
        fallbackUsed: (currentEntries || []).length === 0,
        fallbackItems: fallback
      }
    });
  } catch (e) {
    console.error("myTickets error:", e);
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
}
