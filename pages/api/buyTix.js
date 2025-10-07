import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAccount,
  getMint,
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

// Detect correct token program for the mint (legacy vs token-2022)
async function detectTokenProgram() {
  const mintInfo = await getMint(connection, TIX_MINT).catch(() => null);
  // If getMint succeeds via default program, it’s legacy SPL Token
  if (mintInfo) return TOKEN_PROGRAM_ID;

  // Try Token-2022
  const mint2022 = await getMint(connection, TIX_MINT, undefined, TOKEN_2022_PROGRAM_ID).catch(() => null);
  if (mint2022) return TOKEN_2022_PROGRAM_ID;

  throw new Error("Unable to read TIX mint with either token program");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { walletAddress, solAmount } = req.body;
    if (!walletAddress || !solAmount) {
      return res.status(400).json({ error: "Missing wallet or amount" });
    }

    // Live prices
    const priceRes = await fetch("https://moonticket.io/api/prices");
    const priceData = await priceRes.json();
    const solPriceUsd = Number(priceData?.solPriceUsd || 0);

    const usdSpent = Number(solAmount) * solPriceUsd;
    const tixAmount = Math.floor(usdSpent / TIX_PRICE_USD); // human units
    const amountBase = BigInt(tixAmount) * BigInt(10 ** TIX_DECIMALS); // base units (u64)

    // Pick the right token program for TIX (prevents owner/program mismatches)
    const tokenProgram = await detectTokenProgram();

    const recipient = new PublicKey(walletAddress);

    // Derive ATAs with the correct token program
    const recipientAta = await getAssociatedTokenAddress(TIX_MINT, recipient, false, tokenProgram);
    const treasuryAta  = await getAssociatedTokenAddress(TIX_MINT, TREASURY_WALLET, false, tokenProgram);

    const ixs = [];

    // Ensure recipient ATA exists (treasury pays)
    try {
      await getAccount(connection, recipientAta, undefined, tokenProgram);
    } catch {
      ixs.push(
        createAssociatedTokenAccountInstruction(
          TREASURY_WALLET,   // payer
          recipientAta,
          recipient,
          TIX_MINT,
          tokenProgram
        )
      );
    }

    // Ensure treasury ATA exists (one-time)
    try {
      await getAccount(connection, treasuryAta, undefined, tokenProgram);
    } catch {
      ixs.push(
        createAssociatedTokenAccountInstruction(
          TREASURY_WALLET,
          treasuryAta,
          TREASURY_WALLET,
          TIX_MINT,
          tokenProgram
        )
      );
    }

    // (Optional but strict) sanity-check the treasury ATA owner
    const treyAcc = await getAccount(connection, treasuryAta, undefined, tokenProgram);
    if (!treyAcc.owner.equals(TREASURY_WALLET)) {
      throw new Error("Treasury ATA owner mismatch; refusing to send.");
    }

    // Transfer TIX from treasury -> recipient
    ixs.push(
      createTransferInstruction(
        treasuryAta,
        recipientAta,
        TREASURY_WALLET,    // authority (must sign)
        amountBase,
        [],
        tokenProgram
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

    // Credits: 1 per whole $1 spent
    const creditsToGrant = Math.floor(usdSpent + 1e-6);
    if (creditsToGrant > 0) {
      const { data: row, error: selErr } = await supabase
        .from("pending_tickets")
        .select("id,balance")
        .eq("wallet", walletAddress)
        .maybeSingle();
      if (selErr) throw selErr;

      const nowIso = new Date().toISOString();
      if (row?.id) {
        const { error: updErr } = await supabase
          .from("pending_tickets")
          .update({ balance: Number(row.balance || 0) + creditsToGrant, updated_at: nowIso })
          .eq("id", row.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from("pending_tickets")
          .insert({
            wallet: walletAddress,
            balance: creditsToGrant,
            source: "purchase",
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
