import { Connection, Keypair, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
const TREASURY_SECRET_KEY = bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58);
const TREASURY_KEYPAIR = Keypair.fromSecretKey(TREASURY_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const {
    base64Tx,
    walletAddress,
    solAmount,
    usdSpent,
    tixAmount,
    tixPriceUsd,
    solPriceUsd,
  } = req.body;

  if (!base64Tx || !walletAddress || !tixAmount) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // ✅ Deserialize transaction
    const txBuffer = Buffer.from(base64Tx, "base64");
    const transaction = Transaction.from(txBuffer);

    // ✅ Sign with Treasury
    transaction.partialSign(TREASURY_KEYPAIR);

    // ✅ Submit with partial signatures
    const txid = await connection.sendRawTransaction(
      transaction.serialize({ requireAllSignatures: false })
    );
    await connection.confirmTransaction(txid, "confirmed");

    // ✅ Log entry
    await supabase.from("entries").insert([
      {
        wallet: walletAddress,
        sol_amount: solAmount,
        amount_usd: usdSpent,
        tix_amount: tixAmount,
        entries: usdSpent, // 1 entry = $1
        entry_type: "purchase",
      },
    ]);

    return res.status(200).json({
      success: true,
      txid,
      solAmount,
      usdSpent,
      tixAmount,
      tixPriceUsd,
      solPriceUsd,
    });
  } catch (err) {
    console.error("FinalizeBuyTix error:", err);
    return res.status(500).json({ error: err.message || "Transaction failed" });
  }
}
