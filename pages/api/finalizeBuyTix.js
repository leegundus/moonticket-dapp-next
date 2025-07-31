import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { createClient } from "@supabase/supabase-js";
import { sendSignedTransaction } from "../../lib/sendTx";

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { base64Tx, walletAddress, solAmount, usdSpent, tixAmount, solPriceUsd, tixPriceUsd } = req.body;

  if (!base64Tx || !walletAddress || !tixAmount) {
    return res.status(400).json({ error: "Missing transaction or user data" });
  }

  try {
    const txBuffer = Buffer.from(base64Tx, "base64");
    const tx = require("@solana/web3.js").Transaction.from(txBuffer);

    // Treasury signs
    tx.partialSign(TREASURY_KEYPAIR);

    const txid = await sendSignedTransaction(tx.instructions, TREASURY_KEYPAIR, connection);

    // Supabase entry log
    await supabase.from("entries").insert([
      {
        wallet: walletAddress,
        amount_usd: usdSpent,
        entries: usdSpent,
        tix_amount: tixAmount,
        sol_amount: solAmount,
      },
    ]);

    return res.status(200).json({
      success: true,
      txid,
      tixAmount,
      solAmount,
      usdSpent,
      tixPriceUsd,
      solPriceUsd,
      message: "Buy TIX successful",
    });
  } catch (err) {
    console.error("Finalize buyTix error:", err.message);
    return res.status(500).json({ error: err.message || "Transaction failed" });
  }
}

