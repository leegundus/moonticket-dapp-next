import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const wallet = (req.query.wallet || "").trim();
    if (!wallet) return res.status(400).json({ ok: false, error: "Missing wallet" });

    // 1) Current credits
    const { data: ptRow, error: ptErr } = await supabase
      .from("pending_tickets")
      .select("balance")
      .eq("wallet", wallet)
      .maybeSingle();

    if (ptErr) return res.status(500).json({ ok: false, error: ptErr.message });

    const credits = Number(ptRow?.balance || 0);

    // 2) Latest draw date
    const { data: lastDraw, error: ldErr } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ldErr) return res.status(500).json({ ok: false, error: ldErr.message });

    const latestDrawDate = lastDraw?.draw_date || null;

    // 3) Already claimed free weekly ticket this draw?
    let alreadyClaimedThisDraw = false;

    if (latestDrawDate) {
      const { data: fc, error: fcErr } = await supabase
        .from("free_claims")
        .select("id")
        .eq("wallet", wallet)
        .eq("draw_date", latestDrawDate)
        .maybeSingle();

      if (fcErr && fcErr.code !== "PGRST116") {
        // allow "Results contain 0 rows" style codes to pass silently
        return res.status(500).json({ ok: false, error: fcErr.message });
      }
      alreadyClaimedThisDraw = !!fc?.id;
    }

    return res.status(200).json({
      ok: true,
      credits,
      latestDrawDate,
      alreadyClaimedThisDraw,
    });
  } catch (e) {
    console.error("ticketCredits error:", e);
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
}
