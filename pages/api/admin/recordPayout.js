import { verifyAdminRequest } from "../../../lib/adminAuth";
import { supabaseRest } from "../../../lib/supabaseRestServer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = verifyAdminRequest(req.body, "record_payout");
  if (!auth.ok) return res.status(401).json({ error: auth.error });

  const drawKey = String(auth.payload?.drawKey || "");
  const signatures = Array.isArray(auth.payload?.signatures)
    ? auth.payload.signatures.map((v) => String(v).trim()).filter(Boolean).slice(0, 10)
    : [];

  if (!signatures.length) return res.status(400).json({ error: "Add at least one transaction signature." });

  try {
    const q = new URLSearchParams({
      draw_key: "eq." + drawKey,
      draw_type: "eq.weekly_free",
      status: "eq.winner_selected",
    });
    const updated = await supabaseRest("draws?" + q.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        status: "paid",
        payout_status: "paid",
        payout_tx_signatures: signatures,
        tx_signature: signatures[0],
      }),
    });
    if (!Array.isArray(updated) || !updated.length) {
      return res.status(404).json({ error: "Winner-selected drawing not found." });
    }
    return res.status(200).json({ success: true, draw: updated[0] });
  } catch (err) {
    console.error("recordPayout error:", err?.message, err?.details || "");
    return res.status(500).json({ error: "Could not record payout." });
  }
}
