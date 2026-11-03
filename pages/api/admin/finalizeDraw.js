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
  if (!response.ok || body.error) {
    const err = new Error(body?.error?.message || "Solana RPC request failed");
    err.rpcCode = body?.error?.code;
    throw err;
  }
  return body.result;
}

async function findFinalizedBlock(startSlot) {
  const finalized = await rpc("getSlot", [{ commitment: "finalized" }]);
  if (Number(finalized) < Number(startSlot)) return null;

  for (let slot = Number(startSlot); slot <= Number(startSlot) + 100; slot += 1) {
    try {
      const block = await rpc("getBlock", [
        slot,
        {
          commitment: "finalized",
          transactionDetails: "none",
          rewards: false,
          maxSupportedTransactionVersion: 0,
        },
      ]);
      if (block?.blockhash) return { slot, blockhash: block.blockhash };
    } catch (err) {
      if (err.rpcCode === -32007 || /skipped|not available/i.test(err.message)) continue;
      throw err;
    }
  }
  throw new Error("Could not find a finalized Solana block near the committed slot.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = verifyAdminRequest(req.body, "finalize_draw");
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
    if (draw.status === "winner_selected" || draw.status === "paid") {
      return res.status(409).json({ error: "A winner has already been selected.", draw });
    }
    if (draw.status !== "prepared" || !draw.randomness_slot || !draw.entries_hash) {
      return res.status(400).json({ error: "Prepare the drawing first." });
    }

    const block = await findFinalizedBlock(draw.randomness_slot);
    if (!block) {
      return res.status(425).json({ error: "The committed Solana slot is not finalized yet. Try again shortly." });
    }

    const eq = new URLSearchParams({
      select: "id,wallet,created_at",
      entry_type: "eq.free",
      weekly_draw_key: "eq." + drawKey,
      order: "wallet.asc,id.asc",
    });
    const entries = await supabaseRest("entries?" + eq.toString());
    if (!Array.isArray(entries) || !entries.length) {
      return res.status(400).json({ error: "There are no eligible entries." });
    }

    const snapshot = entries.map((e) => e.id + ":" + e.wallet).join("\n");
    const checkHash = crypto.createHash("sha256").update(snapshot).digest("hex");
    if (checkHash !== draw.entries_hash) {
      return res.status(409).json({ error: "The eligible entry list changed after preparation. Drawing halted." });
    }

    const seedText = ["MoonTicket", drawKey, draw.entries_hash, block.slot, block.blockhash].join("|");
    const seedHex = crypto.createHash("sha256").update(seedText).digest("hex");
    const winnerIndex = Number(BigInt("0x" + seedHex) % BigInt(entries.length));
    const winner = entries[winnerIndex];

    const uq = new URLSearchParams({ id: "eq." + draw.id });
    const updated = await supabaseRest("draws?" + uq.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        status: "winner_selected",
        winner: winner.wallet,
        winner_entry_id: winner.id,
        randomness_slot: block.slot,
        randomness_blockhash: block.blockhash,
        finalized_at: new Date().toISOString(),
        payout_status: "pending",
      }),
    });

    const wq = new URLSearchParams({ id: "eq." + winner.id });
    await supabaseRest("entries?" + wq.toString(), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ is_winner: true }),
    });

    return res.status(200).json({
      success: true,
      winner: winner.wallet,
      winnerIndex,
      entries: entries.length,
      seedHash: seedHex,
      randomness: block,
      draw: updated?.[0] || null,
    });
  } catch (err) {
    console.error("finalizeDraw error:", err?.message, err?.details || "");
    return res.status(500).json({ error: err?.message || "Could not finalize the drawing." });
  }
}
