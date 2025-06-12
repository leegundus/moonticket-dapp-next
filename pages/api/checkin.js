import { createClient } from "@supabase/supabase-js";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import base58 from "bs58";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
const REWARDS_SECRET = process.env.REWARDS_SECRET_KEY_BASE58;
const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);
const DECIMALS = 6;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: "Missing wallet address" });

  try {
    const userWallet = new PublicKey(wallet);
    const rewardsKeypair = Keypair.fromSecretKey(base58.decode(REWARDS_SECRET));
    const tixAmount = BigInt(100 * 10 ** DECIMALS);

    const rewardsATA = await getAssociatedTokenAddress(
      TIX_MINT,
      rewardsKeypair.publicKey
    );
    const userATA = await getAssociatedTokenAddress(
      TIX_MINT,
      userWallet
    );

    console.log("🔍 REWARDS ATA:", rewardsATA.toBase58());
    console.log("🔍 USER ATA:", userATA.toBase58());

    const ix = createTransferInstruction(
      rewardsATA,
      userATA,
      rewardsKeypair.publicKey,
      tixAmount,
      [],
      TOKEN_PROGRAM_ID
    );

    const tx = new Transaction().add(ix);
    const blockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash.blockhash;
    tx.feePayer = rewardsKeypair.publicKey;
    tx.sign(rewardsKeypair);

    const txid = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(txid, "confirmed");

    console.log("✅ Check-in transfer confirmed:", txid);

    return res.status(200).json({
      success: true,
      txid,
      tixAwarded: 100,
    });
  } catch (err) {
    console.error("❌ Check-in failed:", err);
    return res.status(500).json({
      error: "Transfer failed",
      detail: err.message,
    });
  }
}
