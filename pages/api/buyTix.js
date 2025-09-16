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

    // Prices (same as before)
    const priceRes = await fetch("https://moonticket.io/api/prices");
    const priceData = await priceRes.json();
    const solPriceUsd = Number(priceData?.solPriceUsd || 0);

    const usdSpent = Number(solAmount) * solPriceUsd;
    const tixAmount = Math.floor(usdSpent / TIX_PRICE_USD);

    const recipient = new PublicKey(walletAddress);
    const recipientAta = await getAssociatedTokenAddress(TIX_MINT, recipient);
    const recipientAtaInfo = await connection.getAccountInfo(recipientAta);

    const ixs = [];

    // Create recipient ATA if needed (treasury pays this tiny fee)
    if (!recipientAtaInfo) {
      ixs.push(
        createAssociatedTokenAccountInstruction(
          TREASURY_WALLET,   // payer
          recipientAta,
          recipient,
          TIX_MINT
        )
      );
    }

    // TIX transfer from treasury -> recipient
    const treasuryAta = await getAssociatedTokenAddress(TIX_MINT, TREASURY_WALLET);
    ixs.push(
      createTransferInstruction(
        treasuryAta,
        recipientAta,
        TREASURY_WALLET,
        tixAmount * 10 ** TIX_DECIMALS,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const tx = new Transaction().add(...ixs);
    tx.feePayer = TREASURY_WALLET;

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(TREASURY_KEYPAIR);

    const txid = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(txid, "confirmed");

    // Record purchase
    await supabase.from("purchases").insert({
      wallet: walletAddress,
      amount_usd: usdSpent,
      tix_amount: tixAmount,
      sol_amount: Number(solAmount),
      tx_sig: txid,
      created_at: new Date().toISOString(),
    });

    // Grant credits: 1 per whole $1 spent  (NOW tagged as source: 'purchase')
    const creditsToGrant = Math.floor(usdSpent + 1e-6);
    if (creditsToGrant > 0) {
      // Look for existing 'purchase' bucket for this wallet
      const { data: existing, error: selErr } = await supabase
        .from("pending_tickets")
        .select("id,balance")
        .eq("wallet", walletAddress)
        .eq("source", "purchase")
        .maybeSingle();

      if (selErr) throw selErr;

      const nowIso = new Date().toISOString();

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from("pending_tickets")
          .update({
            balance: Number(existing.balance || 0) + creditsToGrant,
            updated_at: nowIso,
          })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("pending_tickets")
          .insert({
            wallet: walletAddress,
            balance: creditsToGrant,
            source: "purchase",          // <-- important: satisfies NOT NULL
            // draw_id: null,             // purchases are generic credits
            created_at: nowIso,
            updated_at: nowIso,
          });
        if (insErr) throw insErr;
      }
    }

    return res.status(200).json({
      success: true,
      txid,
      tixAmount,
      solAmount: Number(solAmount),
      usdSpent,
      tixPriceUsd: TIX_PRICE_USD,
      solPriceUsd,
      creditsGranted: Math.floor(usdSpent + 1e-6),
    });
  } catch (err) {
    console.error("BuyTix error:", err);
    return res.status(500).json({ error: err.message });
  }
}
