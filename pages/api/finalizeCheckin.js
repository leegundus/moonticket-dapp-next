import {
  Connection,
  Keypair,
  Transaction // ✅ Add this to import the Transaction class
} from "@solana/web3.js";
import bs58 from "bs58";

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { base64Tx } = req.body;
    if (!base64Tx) return res.status(400).json({ error: "Missing transaction" });

    const txBuffer = Buffer.from(base64Tx, "base64");
    const tx = Transaction.from(txBuffer);

    tx.partialSign(TREASURY_KEYPAIR);

    const txid = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(txid, "confirmed");

    return res.status(200).json({ success: true, txid });
  } catch (err) {
    console.error("Finalize Checkin Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
