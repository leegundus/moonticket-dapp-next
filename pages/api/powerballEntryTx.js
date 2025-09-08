const { Connection, PublicKey, Transaction } = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount
} = require("@solana/spl-token");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    const { wallet, tickets, tixCostPerTicket } = req.body || {};
    if (!wallet || !Array.isArray(tickets) || !tickets.length || !tixCostPerTicket) {
      return res.status(400).json({ ok: false, error: "Missing wallet, tickets, or tixCostPerTicket" });
    }

    // Validate numbers quickly
    for (const t of tickets) {
      const nums = [t.num1, t.num2, t.num3, t.num4];
      if (nums.some(n => !Number.isInteger(n) || n < 1 || n > 25)) {
        return res.status(400).json({ ok: false, error: "Main numbers must be 1–25 integers" });
      }
      if (new Set(nums).size !== 4) {
        return res.status(400).json({ ok: false, error: "Main numbers must be unique" });
      }
      if (!Number.isInteger(t.moonball) || t.moonball < 1 || t.moonball > 10) {
        return res.status(400).json({ ok: false, error: "Moonball must be 1–10 integer" });
      }
    }

    const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
    const TIX_MINT = new PublicKey(process.env.TIX_MINT);
    const TREASURY_PUB = new PublicKey(process.env.TREASURY_PUBLIC_KEY);

    const connection = new Connection(RPC_URL, "confirmed");
    const userPub = new PublicKey(wallet);

    // Compute total cost in TIX (human units) → base units (6 decimals)
    const TOKEN_DECIMALS = 6;
    const totalHuman = Number(tickets.length) * Number(tixCostPerTicket);
    const totalBase = Math.round(totalHuman * 10 ** TOKEN_DECIMALS);
    if (totalBase <= 0) return res.status(400).json({ ok: false, error: "Computed total cost is zero" });

    const userAta = await getAssociatedTokenAddress(TIX_MINT, userPub, false);
    const treasuryAta = await getAssociatedTokenAddress(TIX_MINT, TREASURY_PUB, false);

    const tx = new Transaction();

    // Ensure Treasury ATA exists (payer = user)
    try { await getAccount(connection, treasuryAta); }
    catch {
      tx.add(createAssociatedTokenAccountInstruction(userPub, treasuryAta, TREASURY_PUB, TIX_MINT));
    }

    // Ensure user ATA exists (optional; if they just bought TIX, it should exist)
    try { await getAccount(connection, userAta); }
    catch {
      tx.add(createAssociatedTokenAccountInstruction(userPub, userAta, userPub, TIX_MINT));
    }

    // Transfer TIX: user → treasury
    tx.add(createTransferInstruction(userAta, treasuryAta, userPub, totalBase));
    tx.feePayer = userPub;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;

    const serialized = tx.serialize({ requireAllSignatures: false });
    const txBase64 = serialized.toString("base64");

    return res.status(200).json({
      ok: true,
      txBase64,
      expectedTotalBase: totalBase, // client will send back on finalize
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
