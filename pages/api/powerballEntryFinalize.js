const { Connection, PublicKey } = require("@solana/web3.js");
const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    const { wallet, signature, tickets, expectedTotalBase } = req.body || {};
    if (!wallet || !signature || !Array.isArray(tickets) || !tickets.length || !expectedTotalBase) {
      return res.status(400).json({ ok: false, error: "Missing wallet, signature, tickets, expectedTotalBase" });
    }

    // Verify numbers again (defense-in-depth)
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
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const TREASURY_PUB = new PublicKey(process.env.TREASURY_PUBLIC_KEY);

    const connection = new Connection(RPC_URL, "confirmed");
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const userPub = new PublicKey(wallet);

    // Confirm transaction & verify transfer into Treasury from user
    const parsed = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
    if (!parsed) return res.status(400).json({ ok: false, error: "Transaction not found" });

    // Sum all token transfers TO treasury from user for the TIX mint
    const TIX_MINT = process.env.TIX_MINT;
    let credited = 0n;

    for (const meta of parsed.meta?.postTokenBalances || []) {
      // We'll compute via pre/post balances difference for Treasury ATA on TIX mint
      // However, simpler & robust path: iterate inner instructions to find transfer to treasury
    }

    // Robust parse: check token balances change (pre vs post)
    const pre = parsed.meta?.preTokenBalances || [];
    const post = parsed.meta?.postTokenBalances || [];
    const dec = 6;

    const treasuryPre = pre.find(b => b.mint === TIX_MINT && b.owner === TREASURY_PUB.toBase58());
    const treasuryPost = post.find(b => b.mint === TIX_MINT && b.owner === TREASURY_PUB.toBase58());
    if (!treasuryPost) return res.status(400).json({ ok: false, error: "Treasury TIX balance not present in tx" });

    const preAmt = BigInt(treasuryPre ? treasuryPre.uiTokenAmount.amount : "0");
    const postAmt = BigInt(treasuryPost.uiTokenAmount.amount);
    credited = postAmt - preAmt;

    if (credited <= 0n) {
      return res.status(400).json({ ok: false, error: "No TIX credited to Treasury in this tx" });
    }

    if (credited !== BigInt(expectedTotalBase)) {
      return res.status(400).json({
        ok: false,
        error: `Amount mismatch. Expected ${expectedTotalBase}, got ${credited.toString()}`
      });
    }

    // Insert one entries row per ticket
    const rows = tickets.map(t => ({
      wallet: userPub.toBase58(),
      entry_type: "purchase",
      num1: t.num1, num2: t.num2, num3: t.num3, num4: t.num4, moonball: t.moonball
    }));

    const { error: insErr } = await supabase.from("entries").insert(rows);
    if (insErr) return res.status(500).json({ ok: false, error: insErr.message });

    return res.status(200).json({ ok: true, inserted: rows.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};

