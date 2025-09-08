const { Connection, PublicKey, Transaction } = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} = require("@solana/spl-token");
const { createClient } = require("@supabase/supabase-js");

function validateTickets(tickets) {
  if (!Array.isArray(tickets) || !tickets.length) return "No tickets";
  for (const t of tickets) {
    const nums = [t?.num1, t?.num2, t?.num3, t?.num4];
    if (nums.some(n => !Number.isInteger(n) || n < 1 || n > 25)) return "Main numbers must be 1–25 integers";
    if (new Set(nums).size !== 4) return "Main numbers must be unique";
    if (!Number.isInteger(t?.moonball) || t.moonball < 1 || t.moonball > 10) return "Moonball must be 1–10 integer";
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { wallet, tickets, tixCostPerTicket, useCredits = 0 } = req.body || {};
    if (!wallet) return res.status(400).json({ ok: false, error: "Missing wallet" });

    const v = validateTickets(tickets);
    if (v) return res.status(400).json({ ok: false, error: v });

    const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const TIX_MINT = new PublicKey(process.env.TIX_MINT);
    const TREASURY_PUB = new PublicKey(process.env.TREASURY_PUBLIC_KEY);

    if (!RPC_URL || !SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ ok: false, error: "Server misconfigured (env)" });
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Fetch latest draw (credits are per-draw)
    const { data: lastDraw, error: de } = await supabase
      .from("draws")
      .select("id")
      .order("draw_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (de) return res.status(500).json({ ok: false, error: de.message });
    const drawId = lastDraw?.id || null;

    // Load available credits for this wallet/draw
    const { data: creditsRows, error: ce } = await supabase
      .from("pending_tickets")
      .select("id,ticket_type,created_at")
      .eq("wallet", wallet)
      .eq("is_redeemed", true)
      .eq("is_consumed", false)
      .eq("draw_id", drawId)
      .order("created_at", { ascending: true });
    if (ce) return res.status(500).json({ ok: false, error: ce.message });

    const availableCredits = creditsRows?.length || 0;
    const lockedCredits = Math.min(Number(useCredits) || 0, availableCredits, tickets.length);

    // Compute amount to pay in TIX
    const payableCount = tickets.length - lockedCredits;
    const TOKEN_DECIMALS = 6;
    const priceHuman = Number(tixCostPerTicket); // e.g. 10000
    if (!Number.isFinite(priceHuman) || priceHuman < 0) {
      return res.status(400).json({ ok: false, error: "Invalid tixCostPerTicket" });
    }
    const totalBase = Math.round(payableCount * priceHuman * 10 ** TOKEN_DECIMALS);

    // If nothing to pay, we still return ok with txBase64=null
    if (payableCount === 0) {
      return res.status(200).json({
        ok: true,
        txBase64: null,
        expectedTotalBase: 0,
        lockedCredits,
      });
    }

    const userPub = new PublicKey(wallet);
    const userAta = await getAssociatedTokenAddress(TIX_MINT, userPub, false);
    const treasuryAta = await getAssociatedTokenAddress(TIX_MINT, TREASURY_PUB, false);

    const tx = new Transaction();

    // Ensure Treasury ATA exists (payer = user)
    try { await getAccount(connection, treasuryAta); }
    catch {
      tx.add(createAssociatedTokenAccountInstruction(userPub, treasuryAta, TREASURY_PUB, TIX_MINT));
    }

    // Ensure user ATA exists
    try { await getAccount(connection, userAta); }
    catch {
      tx.add(createAssociatedTokenAccountInstruction(userPub, userAta, userPub, TIX_MINT));
    }

    // Transfer TIX: user -> treasury (amount for payableCount tickets)
    tx.add(createTransferInstruction(userAta, treasuryAta, userPub, totalBase));
    tx.feePayer = userPub;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;

    const serialized = tx.serialize({ requireAllSignatures: false });
    const txBase64 = Buffer.from(serialized).toString("base64");

    return res.status(200).json({
      ok: true,
      txBase64,
      expectedTotalBase: totalBase,
      lockedCredits,
    });
  } catch (e) {
    console.error("powerballEntryTx error:", e);
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
};

