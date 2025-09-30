import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createClient } from "@supabase/supabase-js";
import bs58 from "bs58";

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);
const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { wallet } = req.body;
  if (!wallet)
    return res.status(400).json({ error: "Missing wallet" });

  try {
    const userPublicKey = new PublicKey(wallet);
    const userATA = await getAssociatedTokenAddress(TIX_MINT, userPublicKey);
    const treasuryATA = await getAssociatedTokenAddress(TIX_MINT, TREASURY_KEYPAIR.publicKey);
    const ataInfo = await connection.getAccountInfo(userATA);

    const { data: existing } = await supabase
      .from("daily_checkins")
      .select("streak_count, last_checkin")
      .eq("wallet", wallet)
      .maybeSingle();

    let streak = 1;
    let rewardAmount = 50_000_000; // 50 TIX @ 6 decimals
    const now = new Date();
    const oneDay = 1000 * 60 * 60 * 24;

    if (existing?.last_checkin) {
      const last = new Date(existing.last_checkin);
      const diff = now - last;

      if (diff < oneDay) {
        return res.status(200).json({ alreadyCheckedIn: true });
      }

      if (diff < oneDay * 2) {
        streak = (existing.streak_count || 0) + 1;
        if (streak > 7) streak = 1;
      }
    }

    const rewardMap = {
      1: 50_000_000,
      2: 50_000_000,
      3: 100_000_000,
      4: 200_000_000,
      5: 300_000_000,
      6: 500_000_000,
      7: 1_000_000_000,
    };
    rewardAmount = rewardMap[streak] ?? 50_000_000;

    const ixs = [];

    // If user has no TIX ATA, add an ATA create (payer = user)
    if (!ataInfo) {
      ixs.push(
        createAssociatedTokenAccountInstruction(
          userPublicKey,   // payer (user pays rent)
          userATA,
          userPublicKey,   // owner
          TIX_MINT
        )
      );
    }

    // Always send the TIX from treasury -> user
    ixs.push(
      createTransferInstruction(
        treasuryATA,
        userATA,
        TREASURY_KEYPAIR.publicKey, // authority (treasury will co-sign server-side)
        rewardAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: userPublicKey, recentBlockhash: blockhash }).add(...ixs);

    // DO NOT sign here — client signs first, then server co-signs in /api/finalizeCheckin
    const base64Tx = tx.serialize({ requireAllSignatures: false }).toString("base64");

    return res.status(200).json({
      transaction: base64Tx,
      streak,
      rewardAmount,
    });
  } catch (e) {
    console.error("Check-in API error:", e);
    return res.status(500).json({ error: "Transaction build failed", detail: e.message });
  }
}
