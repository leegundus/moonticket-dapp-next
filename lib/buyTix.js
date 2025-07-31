const {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
} = require("@solana/web3.js");

const {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");

const bs58 = require("bs58");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TIX_MINT = new PublicKey("8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek");
const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);
const TREASURY_WALLET = TREASURY_KEYPAIR.publicKey;

const TIX_PRICE_USD = 0.0001;
const TIX_DECIMALS = 6;

async function buildBuyTixTransaction(buyerPublicKeyString, solAmount) {
  console.log("=== BuyTix LIB ===");
  console.log("Input:", { buyerPublicKeyString, solAmount });

  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
  const buyerPublicKey = new PublicKey(buyerPublicKeyString);

  const priceRes = await fetch("https://moonticket.io/api/prices");
  const priceData = await priceRes.json();
  const solPriceUsd = priceData?.solPriceUsd || 0;

  const usdSpent = solAmount * solPriceUsd;
  const tixAmount = Math.floor(usdSpent / TIX_PRICE_USD);
  const tixAmountRaw = BigInt(tixAmount) * BigInt(10 ** TIX_DECIMALS);

  const fromTokenAccount = await getAssociatedTokenAddress(TIX_MINT, TREASURY_WALLET);
  const recipientTokenAccountAddress = await getAssociatedTokenAddress(TIX_MINT, buyerPublicKey);

  const ataInfo = await connection.getAccountInfo(recipientTokenAccountAddress);
  const transaction = new Transaction();

  if (!ataInfo) {
    const createAtaIx = createAssociatedTokenAccountInstruction(
      buyerPublicKey, // payer (user)
      recipientTokenAccountAddress,
      buyerPublicKey,
      TIX_MINT
    );
    transaction.add(createAtaIx);
  }

  const transferIx = createTransferInstruction(
    fromTokenAccount,
    recipientTokenAccountAddress,
    TREASURY_WALLET,
    tixAmountRaw,
    [],
    TOKEN_PROGRAM_ID
  );
  transaction.add(transferIx);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = buyerPublicKey;

  // Treasury signs only later
  const serialized = transaction.serialize({ requireAllSignatures: false });

  return {
    base64Tx: serialized.toString("base64"),
    tixAmount,
    solAmount,
    usdSpent,
    tixPriceUsd: TIX_PRICE_USD,
    solPriceUsd,
  };
}

module.exports = buildBuyTixTransaction;
