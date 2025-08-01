import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createTransferInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT_ADDRESS);
const TREASURY = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { walletAddress, tixAmount } = req.body;

    if (!walletAddress || !tixAmount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = new PublicKey(walletAddress);
    const userATA = await getAssociatedTokenAddress(TIX_MINT, user);
    const treasuryATA = await getAssociatedTokenAddress(TIX_MINT, TREASURY);

    const ataInfo = await connection.getAccountInfo(userATA);
    const blockhash = await connection.getLatestBlockhash();

    const transaction = new Transaction({
      feePayer: user,
      recentBlockhash: blockhash.blockhash,
    });

    // If user doesn't have an ATA, include create instruction
    if (!ataInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          user, // payer
          userATA,
          user,
          TIX_MINT
        )
      );
    }

    // Add TIX transfer from treasury to user
    transaction.add(
      createTransferInstruction(
        treasuryATA,
        userATA,
        TREASURY, // treasury signs later
        tixAmount
      )
    );

    // DO NOT SIGN on backend
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    const base64Tx = serialized.toString("base64");

    return res.status(200).json({ base64Tx });
  } catch (err) {
    console.error("BuyTix error:", err);
    return res.status(500).json({ error: err.message || "Transaction build failed" });
  }
}
