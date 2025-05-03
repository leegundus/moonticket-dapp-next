const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");

const bs58 = require("bs58");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const TIX_MINT = new PublicKey("8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek");
const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);
const TREASURY_WALLET = TREASURY_KEYPAIR.publicKey;

const TIX_PRICE_USD = 0.0001;

async function buyTix(buyerPublicKeyString, solAmount) {
  console.log("=== BuyTix LIB ===");
  console.log("Input:", { buyerPublicKeyString, solAmount });

  const connection = new Connection("process.env.NEXT_PUBLIC_RPC_URL");
  const buyerPublicKey = new PublicKey(buyerPublicKeyString);

  const priceRes = await fetch("https://moonticket.io/api/prices");
  const priceData = await priceRes.json();
  const solPriceUsd = priceData?.solPriceUsd || 0;

  const usdSpent = solAmount * solPriceUsd;
  const tixAmount = Math.floor(usdSpent / TIX_PRICE_USD);
  const TIX_DECIMALS = 6;
  const tixAmountRaw = BigInt(tixAmount) * BigInt(10 ** TIX_DECIMALS);

  const fromTokenAccount = await getAssociatedTokenAddress(TIX_MINT, TREASURY_WALLET);
  const recipientTokenAccountAddress = await getAssociatedTokenAddress(TIX_MINT, buyerPublicKey);

  // Check if recipient ATA exists
  const ataInfo = await connection.getAccountInfo(recipientTokenAccountAddress);

  const transaction = new Transaction();

  if (!ataInfo) {
    // Create ATA if not exists
    const createAtaIx = createAssociatedTokenAccountInstruction(
      TREASURY_WALLET,
      recipientTokenAccountAddress,
      buyerPublicKey,
      TIX_MINT
    );
    transaction.add(createAtaIx);
  }

  // Always add transfer instruction
  const transferIx = createTransferInstruction(
    fromTokenAccount,
    recipientTokenAccountAddress,
    TREASURY_WALLET,
    tixAmountRaw,
    [],
    TOKEN_PROGRAM_ID
  );
  transaction.add(transferIx);

  const blockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash.blockhash;
  transaction.feePayer = TREASURY_WALLET;

  await sendAndConfirmTransaction(connection, transaction, [TREASURY_KEYPAIR], {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  });

  // Return immediately to avoid timeout
  const result = {
    success: true,
    tixAmount,
    solAmount,
    usdSpent,
    tixPriceUsd: TIX_PRICE_USD,
    solPriceUsd,
    message: "TIX transferred successfully. SOL handled by frontend.",
  };

  // Log to Supabase (non-blocking)
  try {
    await supabase.from("entries").insert([
      {
        wallet: buyerPublicKey.toBase58(),
        amount_usd: usdSpent,
        entries: usdSpent,
        tix_amount: tixAmount,
        sol_amount: solAmount,
      },
    ]);
  } catch (e) {
    console.error("Supabase insert failed:", e.message);
  }

  return result;
}

module.exports = buyTix;
