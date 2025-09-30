import {
  Connection,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL, "confirmed");
const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { base64Tx } = req.body || {};
    if (!base64Tx) {
      return res.status(400).json({ error: "Missing transaction" });
    }

    // Recreate the user's partially-signed transaction
    const tx = Transaction.from(Buffer.from(base64Tx, "base64"));

    // Co-sign as treasury (authority for the SPL transfer). Do not modify instructions.
    tx.partialSign(TREASURY_KEYPAIR);

    // Safety: ensure there are no missing signatures before send
    const missing = tx.signatures.filter((s) => s.signature === null).map((s) => s.publicKey.toBase58());
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Transaction missing required signatures",
        missingSigners: missing,
      });
    }

    // Broadcast
    const txid = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    // Confirm
    await connection.confirmTransaction(txid, "confirmed");

    return res.status(200).json({ success: true, txid });
  } catch (err) {
    console.error("Finalize Checkin Error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Finalize failed" });
  }
}
