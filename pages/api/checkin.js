import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction } from "@solana/spl-token";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
const TREASURY_KEYPAIR = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.TREASURY_SECRET_KEY)));
const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);
const REWARD_AMOUNT = 250_000; // 250 TIX (6 decimals)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: "Missing wallet" });

  const userPublicKey = new PublicKey(wallet);

  try {
    // 1. Check if user already has an ATA
    const userATA = await getAssociatedTokenAddress(TIX_MINT, userPublicKey);
    const ataInfo = await connection.getAccountInfo(userATA);
    
    const instructions = [];

    if (!ataInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          TREASURY_KEYPAIR.publicKey, // payer
          userATA,
          userPublicKey,
          TIX_MINT
        )
      );
    }

    // 2. Add TIX transfer
    instructions.push(
      createTransferInstruction(
        await getAssociatedTokenAddress(TIX_MINT, TREASURY_KEYPAIR.publicKey),
        userATA,
        TREASURY_KEYPAIR.publicKey,
        REWARD_AMOUNT
      )
    );

    const transaction = new Transaction().add(...instructions);
    
    // ✅ These two lines are critical to avoid Phantom "malicious" warning:
    transaction.feePayer = userPublicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    const serialized = transaction.serialize({ requireAllSignatures: false });
    const base64Tx = serialized.toString("base64");

    // (Optional) Lookup streak now to return with transaction
    const { data: existing } = await supabase
      .from("daily_checkins")
      .select("streak_count, last_checkin")
      .eq("wallet", wallet)
      .single();

    let streak = 1;
    if (existing?.last_checkin) {
      const last = new Date(existing.last_checkin);
      const now = new Date();
      const diff = now - last;
      const oneDay = 1000 * 60 * 60 * 24;

      if (diff < oneDay * 2) streak = existing.streak_count + 1;
    }

    return res.status(200).json({ transaction: base64Tx, streak });
  } catch (e) {
    console.error("Check-in API error:", e);
    return res.status(500).json({ error: "Transaction build failed", detail: e.message });
  }
}

