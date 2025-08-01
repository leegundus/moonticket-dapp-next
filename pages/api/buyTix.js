import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import { createClient } from "@supabase/supabase-js";

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);
const TIX_DECIMALS = 6;
const TIX_PRICE_USD = 0.0001;

const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);
const TREASURY_WALLET = TREASURY_KEYPAIR.publicKey;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { walletAddress, solAmount } = req.body;
    if (!walletAddress || !solAmount) {
      return res.status(400).json({ error: "Missing wallet or amount" });
    }

    const recipient = new PublicKey(walletAddress);
    const ata = await getAssociatedTokenAddress(TIX_MINT, recipient);
    const ataInfo = await connection.getAccountInfo(ata);
    const instructions = [];

    if (!ataInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          TREASURY_WALLET,
          ata,
          recipient,
          TIX_MINT
        )
      );
    }

    const priceRes = await fetch("https://moonticket.io/api/prices");
    const priceData = await priceRes.json();
    const solPriceUsd = priceData?.solPriceUsd || 0;
    const usdSpent = solAmount * solPriceUsd;
    const tixAmount = Math.floor(usdSpent / TIX_PRICE_USD);

    const transferIx = createTransferInstruction(
      await getAssociatedTokenAddress(TIX_MINT, TREASURY_WALLET),
      ata,
      TREASURY_WALLET,
      tixAmount * 10 ** TIX_DECIMALS,
      [],
      TOKEN_PROGRAM_ID
    );

    instructions.push(transferIx);

    const tx = new Transaction().add(...instructions);
    tx.feePayer = TREASURY_WALLET;

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(TREASURY_KEYPAIR);

    const txid = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(txid, "confirmed");

    await supabase.from("entries").insert({
      wallet: walletAddress,
      amount_usd: usdSpent,
      tix_amount: tixAmount,
      sol_amount: solAmount,
      entries: usdSpent,
      entry_type: "purchase",
    });

    return res.status(200).json({
      success: true,
      txid,
      tixAmount,
      solAmount,
      usdSpent,
      tixPriceUsd: TIX_PRICE_USD,
      solPriceUsd,
    });
  } catch (err) {
    console.error("BuyTix error:", err);
    return res.status(500).json({ error: err.message });
  }
}
