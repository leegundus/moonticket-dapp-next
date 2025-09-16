import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok:false, error:"Method not allowed" });
  try {
    const wallet = (req.query.wallet || "").trim();
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });

    // current credits
    const { data: pt, error: ptErr } = await supabase
      .from("pending_tickets").select("balance").eq("wallet", wallet).maybeSingle();
    if (ptErr) return res.status(500).json({ ok:false, error: ptErr.message });
    const credits = Number(pt?.balance || 0);

    // latest draw (id + date)
    const { data: lastDraw, error: ldErr } = await supabase
      .from("draws").select("id, draw_date").order("draw_date", { ascending:false }).limit(1).maybeSingle();
    if (ldErr) return res.status(500).json({ ok:false, error: ldErr.message });

    let alreadyClaimedThisDraw = false;
    if (lastDraw?.id) {
      const { data: fc, error: fcErr } = await supabase
        .from("free_claims").select("id").eq("wallet", wallet).eq("draw_id", lastDraw.id).maybeSingle();
      if (fcErr && fcErr.code !== "PGRST116") return res.status(500).json({ ok:false, error: fcErr.message });
      alreadyClaimedThisDraw = !!fc?.id;
    }

    return res.status(200).json({
      ok: true,
      credits,
      latestDrawDate: lastDraw?.draw_date || null,
      latestDrawId: lastDraw?.id || null,
      alreadyClaimedThisDraw,
    });
  } catch (e) {
    console.error("ticketCredits error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
