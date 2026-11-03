import { verifyAdminRequest } from "../../../lib/adminAuth";
import { supabaseRest } from "../../../lib/supabaseRestServer";

const TIX_MINT = "8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek";
const ALLOWED = new Set(["TIX", "SOL", "TOKEN", "NFT", "OTHER"]);

function cleanItem(item) {
  const type = String(item?.type || "").toUpperCase();
  if (!ALLOWED.has(type)) return null;
  const clean = {
    type,
    label: String(item?.label || type).slice(0, 120),
  };
  if (item?.amount !== undefined && item?.amount !== "") clean.amount = String(item.amount).slice(0, 80);
  if (item?.mint) clean.mint = String(item.mint).slice(0, 80);
  if (item?.description) clean.description = String(item.description).slice(0, 240);
  if (type === "TIX") clean.mint = TIX_MINT;
  return clean;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = verifyAdminRequest(req.body, "set_prize");
  if (!auth.ok) return res.status(401).json({ error: auth.error });

  const drawKey = String(auth.payload?.drawKey || "");
  const rawItems = Array.isArray(auth.payload?.items) ? auth.payload.items : [];
  const items = rawItems.map(cleanItem).filter(Boolean).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(drawKey)) {
    return res.status(400).json({ error: "Invalid drawing date." });
  }
  if (!items.length) return res.status(400).json({ error: "Add at least one prize." });

  try {
    const q = new URLSearchParams({ draw_key: "eq." + drawKey, draw_type: "eq.weekly_free" });
    const updated = await supabaseRest("draws?" + q.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ prize_bundle: items }),
    });
    if (!Array.isArray(updated) || !updated.length) {
      return res.status(404).json({ error: "Drawing not found." });
    }
    return res.status(200).json({ success: true, draw: updated[0] });
  } catch (err) {
    console.error("setPrize error:", err?.message, err?.details || "");
    return res.status(500).json({ error: "Could not save the prize bundle." });
  }
}
