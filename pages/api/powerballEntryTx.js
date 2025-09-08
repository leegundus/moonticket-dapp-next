import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { createClient } from "@supabase/supabase-js";

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL, "confirmed");
const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);

// derive treasury public from your existing secret (same as buyTix.js)
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
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

    // Latest draw → available credits
    const { data: lastDraw, error: de } = await supabase
      .from("draws")
      .select("id")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (de) return res.status(500).json({ ok:false, error: de.message });
    const drawId = lastDraw?.id || null;

    const { data: creditRows, error: ce } = await supabase
      .from("pending_tickets")
      .select("id,created_at")
      .eq("wallet", wallet)
      .eq("is_redeemed", true)
      .eq("is_consumed", false)
      .eq("draw_id", drawId)
      .order("created_at", { ascending: true });
    if (ce) return res.status(500).json({ ok:false, error: ce.message });

    const availableCredits = creditRows?.length || 0;
    const lockedCredits = Math.min(Number(useCredits) || 0, availableCredits, tickets.length);

    // Cost math
    const TOKEN_DECIMALS = 6;
    const priceHuman = Number(tixCostPerTicket); // e.g., 10000
    if (!Number.isFinite(priceHuman) || priceHuman < 0) {
      return res.status(400).json({ ok:false, error:"Invalid tixCostPerTicket" });
    }
    const payableCount = tickets.length - lockedCredits;
    const expectedTotalBase = Math.round(payableCount * priceHuman * 10 ** TOKEN_DECIMALS);

    // No payment needed → return with null tx
    if (payableCount === 0) {
      return res.status(200).json({ ok:true, txBase64:null, expectedTotalBase:0, lockedCredits });
    }

    // Build unsigned token transfer: user -> treasury
    const userPub = new PublicKey(wallet);
    const userAta = await getAssociatedTokenAddress(TIX_MINT, userPub, false);
    const treasuryAta = await getAssociatedTokenAddress(TIX_MINT, TREASURY_WALLET, false);

    const tx = new Transaction();

    // Ensure ATAs exist (payer = user)
    try { await getAccount(connection, userAta); }
    catch { tx.add(createAssociatedTokenAccountInstruction(userPub, userAta, userPub, TIX_MINT)); }

    try { await getAccount(connection, treasuryAta); }
    catch { tx.add(createAssociatedTokenAccountInstruction(userPub, treasuryAta, TREASURY_WALLET, TIX_MINT)); }

    tx.add(createTransferInstruction(userAta, treasuryAta, userPub, expectedTotalBase));
    tx.feePayer = userPub;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;

    const txBase64 = Buffer.from(
      tx.serialize({ requireAllSignatures: false })
    ).toString("base64");

    return res.status(200).json({
      ok:true,
      txBase64,
      expectedTotalBase,
      lockedCredits
    });
  } catch (e) {
    console.error("powerballEntryTx error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
