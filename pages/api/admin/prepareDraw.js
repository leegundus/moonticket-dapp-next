import crypto from "crypto";
import { verifyAdminRequest } from "../../../lib/adminAuth";
import { supabaseRest } from "../../../lib/supabaseRestServer";

async function rpc(method, params = []) {
  const url = process.env.NEXT_PUBLIC_RPC_URL;
  if (!url) throw new Error("Solana RPC is not configured.");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body?.error?.message || "Solana RPC request failed");
  return body.result;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = verifyAdminRequest(req.body, "prepare_draw");
  if (!auth.ok) return res.status(401).json({ error: auth.error });
  const drawKey = String(auth.payload?.drawKey || "");

  try {
    const dq = new URLSearchParams({
      select: "*",
      draw_key: "eq." + drawKey,
      draw_type: "eq.weekly_free",
      limit: "1",
    });
    const draws = await supabaseRest("draws?" + dq.toString());
    const draw = draws?.[0];
    if (!draw) return res.status(404).json({ error: "Drawing not found." });
    if (draw.status === "prepared" || draw.status === "winner_selected" || draw.status === "paid") {
      return res.status(409).json({ error: "This drawing has already been prepared." });
    }

    const cutoff = new Date(draw.draw_date);
    if (Date.now() < cutoff.getTime()) {
      return res.status(400).json({ error: "Entries are still open for this drawing." });
    }

    const eq = new URLSearchParams({
      select: "id,wallet,created_at",
      entry_type: "eq.free",
      weekly_draw_key: "eq." + drawKey,
      order: "wallet.asc,id.asc",
    });
    const entries = await supabaseRest("entries?" + eq.toString());
    if (!Array.isArray(entries) || !entries.length) {
      return res.status(400).json({ error: "There are no eligible entries for this drawing." });
    }

    const snapshot = entries.map((e) => e.id + ":" + e.wallet).join("\n");
    const entriesHash = crypto.createHash("sha256").update(snapshot).digest("hex");
    const currentSlot = await rpc("getSlot", [{ commitment: "finalized" }]);
    const targetSlot = Number(currentSlot) + 20;

    const uq = new URLSearchParams({ id: "eq." + draw.id });
    const updated = await supabaseRest("draws?" + uq.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        status: "prepared",
        entries: entries.length,
        entries_hash: entriesHash,
        randomness_slot: targetSlot,
        prepared_at: new Date().toISOString(),
      }),
    });

    return res.status(200).json({
      success: true,
      draw: updated?.[0] || null,
      message: "Entry list locked. Finalize after the target Solana slot is finalized.",
    });
  } catch (err) {
    console.error("prepareDraw error:", err?.message, err?.details || "");
    return res.status(500).json({ error: "Could not prepare the drawing." });
  }
}
