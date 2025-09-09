import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { createClient } from "@supabase/supabase-js";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL, "confirmed");
const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);
const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);
const TREASURY_WALLET = TREASURY_KEYPAIR.publicKey;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try {
    const { wallet, tickets, tixCostPerTicket, useCredits = 0 } = req.body || {};
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });
    const v = validateTickets(tickets);
    if (v) return res.status(400).json({ ok:false, error: v });

    // Credits available since last draw
    const { data: lastDraw, error: de } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (de) return res.status(500).json({ ok:false, error: de.message });
    const drawStart = lastDraw?.draw_date || null;

    let q = supabase
      .from("pending_tickets")
      .select("id, created_at")
      .eq("wallet", wallet)
      .eq("is_redeemed", true)
      .eq("is_consumed", false)
      .order("created_at", { ascending: true });
    if (drawStart) q = q.gte("created_at", drawStart);

    const { data: creditRows, error: ce } = await q;
    if (ce) return res.status(500).json({ ok:false, error: ce.message });

    const availableCredits = creditRows?.length || 0;
    const lockedCredits = Math.min(Number(useCredits) || 0, availableCredits, tickets.length);

    // Cost math
    const TOKEN_DECIMALS = 6;
    const priceHuman = Number(tixCostPerTicket);
    if (!Number.isFinite(priceHuman) || priceHuman < 0) {
      return res.status(400).json({ ok:false, error:"Invalid tixCostPerTicket" });
    }
    const payableCount = tickets.length - lockedCredits;
    const expectedTotalBase = Math.round(payableCount * priceHuman * 10 ** TOKEN_DECIMALS);

    // If no payment needed, no tx, but still return a 0-fee estimate
    if (payableCount === 0) {
      return res.status(200).json({
        ok:true,
        txBase64:null,
        expectedTotalBase:0,
        lockedCredits,
        feeLamports: 0,
        rentLamports: 0,
        willCreateUserAta: false,
        estTotalLamports: 0
      });
    }

    const userPub = new PublicKey(wallet);
    const userAta = await getAssociatedTokenAddress(TIX_MINT, userPub, false);
    const treasuryAta = await getAssociatedTokenAddress(TIX_MINT, TREASURY_WALLET, false);

    const tx = new Transaction();
    let willCreateUserAta = false;
    let willCreateTreasuryAta = false;

    // Ensure user ATA (payer = user)
    try { await getAccount(connection, userAta); }
    catch {
      willCreateUserAta = true;
      tx.add(createAssociatedTokenAccountInstruction(userPub, userAta, userPub, TIX_MINT));
    }

    // Ensure treasury ATA (payer = user). This should almost always exist.
    try { await getAccount(connection, treasuryAta); }
    catch {
      willCreateTreasuryAta = true;
      tx.add(createAssociatedTokenAccountInstruction(userPub, treasuryAta, TREASURY_WALLET, TIX_MINT));
    }

    // Transfer user -> treasury
    tx.add(createTransferInstruction(userAta, treasuryAta, userPub, expectedTotalBase));
    tx.feePayer = userPub;

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    // ----- Fee & rent estimate -----
    // Base fee (signatures + compute)
    const feeLamports = await connection.getFeeForMessage(tx.compileMessage())
      .then(v => Number(v?.value || 0))
      .catch(() => 0);

    // Rent for new ATAs (165 bytes each)
    const RENT_BYTES = 165;
    let rentLamports = 0;
    if (willCreateUserAta) {
      rentLamports += await connection.getMinimumBalanceForRentExemption(RENT_BYTES);
    }
    if (willCreateTreasuryAta) {
      rentLamports += await connection.getMinimumBalanceForRentExemption(RENT_BYTES);
    }
    const estTotalLamports = feeLamports + rentLamports;

    const txBase64 = Buffer.from(
      tx.serialize({ requireAllSignatures: false })
    ).toString("base64");

    return res.status(200).json({
      ok:true,
      txBase64,
      expectedTotalBase,
      lockedCredits,
      feeLamports,
      rentLamports,
      willCreateUserAta,
      estTotalLamports
    });
  } catch (e) {
    console.error("powerballEntryTx error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
