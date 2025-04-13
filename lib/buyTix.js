const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const {
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");

const bs58 = require("bs58");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// === Constants ===
const TIX_MINT = new PublicKey("CnDaNe3EpAgu2R2aK49nhnH9byf9Y3TWpm689uxavMbM");
const PROGRAM_ID = new PublicKey("GmyMFG4QwHh2YK4bjy489eBzf9Hzf3BLZ1sFfznoeWpB");
const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);
const TREASURY_WALLET = TREASURY_KEYPAIR.publicKey;

// === Hardcoded Treasury address (used in frontend for SOL transfers) ===
const TREASURY_ADDRESS = new PublicKey("FrAvtjXo5JCsWrjcphvWCGQDrXX8PuEbN2qu2SGdvurG");

// === Static TIX price only ===
const TIX_PRICE_USD = 0.0001;

async function buyTix(buyerPublicKeyString, solAmount) {
  try {
    const connection = new Connection("https://api.devnet.solana.com");
    const buyerPublicKey = new PublicKey(buyerPublicKeyString);

    // === Fetch live SOL price ===
    const priceRes = await fetch("http://localhost:3000/api/prices");
    const priceData = await priceRes.json();
    const solPriceUsd = priceData?.solPriceUsd || 0;

    const usdSpent = solAmount * solPriceUsd;
    const tixAmount = Math.floor(usdSpent / TIX_PRICE_USD);
    const tixAmountRaw = BigInt(tixAmount * 1e9);

    const fromTokenAccount = await getAssociatedTokenAddress(TIX_MINT, TREASURY_WALLET);

    // Automatically create recipient ATA if missing
    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      TREASURY_KEYPAIR,
      TIX_MINT,
      buyerPublicKey
    );

    const blockhash = await connection.getLatestBlockhash();
    const tokenTx = new Transaction({
      recentBlockhash: blockhash.blockhash,
      feePayer: TREASURY_WALLET,
    }).add(
      createTransferInstruction(
        fromTokenAccount,
        recipientTokenAccount.address,
        TREASURY_WALLET,
        tixAmountRaw,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(connection, tokenTx, [TREASURY_KEYPAIR], {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    });

    await supabase.from("entries").insert([
      {
        wallet: buyerPublicKey.toBase58(),
        amount_usd: usdSpent,
        entries: usdSpent, // 1 entry per $1 spent
        tix_amount: tixAmount,
        sol_amount: solAmount,
      },
    ]);

    return {
      success: true,
      tixAmount,
      solAmount,
      usdSpent,
      tixPriceUsd: TIX_PRICE_USD,
      solPriceUsd,
      message: "TIX transferred successfully. SOL handled by frontend.",
    };
  } catch (err) {
    console.error("Transaction failed:", err.message);
    throw new Error("Transaction failed: " + err.message);
  }
}

module.exports = buyTix;
