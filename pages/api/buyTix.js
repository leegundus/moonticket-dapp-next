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
const TIX_PRICE_USD = 0.0001; // $TIX price you’re already using

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
    const { walletAddress, solAmount, txSig } = req.body || {};
    if (!walletAddress) return res.status(400).json({ error: "Missing wallet" });

    // Fetch prices for consistent calc in both phases
    const priceRes = await fetch("https://moonticket.io/api/prices");
    const priceData = await priceRes.json();
    const solPriceUsd = Number(priceData?.solPriceUsd || 0);
    const usdSpent = Number(solAmount || 0) * solPriceUsd;
    const tixAmount = Math.floor(usdSpent / TIX_PRICE_USD);

    const buyer = new PublicKey(walletAddress);

    // ---------------------------
    // PHASE 2: Finalize (client already sent SPL transfer and gives us txSig)
    // ---------------------------
    if (txSig) {
      // Record purchase
      await supabase.from("purchases").insert({
        wallet: walletAddress,
        amount_usd: usdSpent,
        tix_amount: tixAmount,
        sol_amount: Number(solAmount || 0),
        tx_sig: txSig,
        created_at: new Date().toISOString(),
      });

      // Grant credits: 1 per whole $1
      const creditsToGrant = Math.floor(usdSpent + 1e-6);
      if (creditsToGrant > 0) {
        // Ensure row exists, then increment balance
        await supabase
          .from("pending_tickets")
          .upsert({ wallet: walletAddress, balance: 0 }, { onConflict: "wallet" });

        const { data: balRow } = await supabase
          .from("pending_tickets")
          .select("balance")
          .eq("wallet", walletAddress)
          .maybeSingle();

        const current = Number(balRow?.balance || 0);
        const newBalance = current + creditsToGrant;

        await supabase
          .from("pending_tickets")
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq("wallet", walletAddress);
      }

      return res.status(200).json({
        success: true,
        txid: txSig,
        tixAmount,
        solAmount: Number(solAmount || 0),
        usdSpent,
        tixPriceUsd: TIX_PRICE_USD,
        solPriceUsd,
        creditsGranted: Math.floor(usdSpent + 1e-6),
      });
    }

    // ---------------------------
    // PHASE 1: Prepare (server partially signs; BUYER will pay fee)
    // ---------------------------
    if (!solAmount) return res.status(400).json({ error: "Missing amount" });

    const recipientAta = await getAssociatedTokenAddress(TIX_MINT, buyer);
    const ataInfo = await connection.getAccountInfo(recipientAta);

    const ixs = [];
    // If buyer doesn't have a TIX ATA, include ATA create (payer = buyer)
    if (!ataInfo) {
      ixs.push(
        createAssociatedTokenAccountInstruction(
          buyer,       // payer — buyer will sign & pay fee
          recipientAta,
          buyer,
          TIX_MINT
        )
      );
    }

    // Transfer from treasury ATA -> buyer ATA; authority = TREASURY_WALLET
    const treasuryAta = await getAssociatedTokenAddress(TIX_MINT, TREASURY_WALLET);
    ixs.push(
      createTransferInstruction(
        treasuryAta,
        recipientAta,
        TREASURY_WALLET, // authority (treasury signs here)
        tixAmount * 10 ** TIX_DECIMALS,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const tx = new Transaction().add(...ixs);
    tx.feePayer = buyer; // BUYER pays the fee
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    // Partial sign with treasury to authorize the token transfer
    tx.sign(TREASURY_KEYPAIR);

    // Serialize *without* requiring all signatures (buyer adds theirs)
    const serialized = tx.serialize({ requireAllSignatures: false });
    const txBase64 = Buffer.from(serialized).toString("base64");

    return res.status(200).json({
      success: true,
      phase: "prepare",
      txBase64,
      tixAmount,
      solAmount: Number(solAmount || 0),
      usdSpent,
      tixPriceUsd: TIX_PRICE_USD,
      solPriceUsd,
    });
  } catch (err) {
    console.error("BuyTix error:", err);
    return res.status(500).json({ error: err.message });
  }
}
