import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
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

// ⬇️ OPS wallet for the 20% split (server-side)
const OPS_WALLET = new PublicKey("nJmonUssRvbp85Nvdd9Bnxgh86Hf6BtKfu49RdcoYE9");

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

    // Grant credits: 1 per whole $1 spent  (single-row per wallet)
    const creditsToGrant = Math.floor(usdSpent + 1e-6);
    if (creditsToGrant > 0) {
      // Read current row (unique on wallet)
      const { data: row, error: selErr } = await supabase
        .from("pending_tickets")
        .select("id,balance")
        .eq("wallet", walletAddress)
        .maybeSingle();
      if (selErr) throw selErr;

      const nowIso = new Date().toISOString();

      if (row?.id) {
        // bump existing balance
        const { error: updErr } = await supabase
          .from("pending_tickets")
          .update({
            balance: Number(row.balance || 0) + creditsToGrant,
            updated_at: nowIso,
          })
          .eq("id", row.id);
        if (updErr) throw updErr;
      } else {
        // create the single wallet row
        const { error: insErr } = await supabase
          .from("pending_tickets")
          .insert({
            wallet: walletAddress,
            balance: creditsToGrant,
            source: "purchase",           // satisfies NOT NULL, informational
            created_at: nowIso,
            updated_at: nowIso,
          });
        if (insErr) throw insErr;
      }
    }

    // ⬇️ Do the 80/20 split server-side from treasury (best-effort; won't fail the response)
    try {
      const totalLamports = Math.floor(Number(solAmount) * 1e9);
      const opsLamports = Math.floor(totalLamports * 0.20);

      if (opsLamports > 0) {
        const splitTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: TREASURY_WALLET,
            toPubkey: OPS_WALLET,
            lamports: opsLamports,
          })
        );

        const { blockhash: splitBlockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        splitTx.recentBlockhash = splitBlockhash;
        splitTx.feePayer = TREASURY_WALLET;
        splitTx.sign(TREASURY_KEYPAIR);

        const splitSig = await connection.sendRawTransaction(splitTx.serialize());
        await connection.confirmTransaction(
          { signature: splitSig, blockhash: splitBlockhash, lastValidBlockHeight },
          "confirmed"
        );
      }
    } catch (splitErr) {
      console.error("Post-buy 80/20 split failed (non-fatal):", splitErr);
      // continue; do not throw — purchase is already successful
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
