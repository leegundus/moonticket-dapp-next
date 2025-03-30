const {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction
} = require("@solana/web3.js");

const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  TOKEN_PROGRAM_ID
} = require("@solana/spl-token");

const bs58 = require("bs58");

// === CONFIG ===
const SOL_PRICE_USD = 180;
const TIX_PRICE_USD = 0.00001;
const DECIMALS = 9;

const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC, "confirmed");

const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);

const TREASURY_WALLET = TREASURY_KEYPAIR.publicKey;
const FOUNDER_WALLET = new PublicKey(process.env.NEXT_PUBLIC_FOUNDER_WALLET);
const TOKEN_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);

// === MAIN FUNCTION ===
async function buyTix(walletAddress, solAmount) {
  const FOUNDER_FEE = solAmount * 0.01;
  const TIX_AMOUNT = Math.floor((solAmount * SOL_PRICE_USD) / TIX_PRICE_USD);
  const TIX_AMOUNT_RAW = TIX_AMOUNT * 10 ** DECIMALS;

  const buyerPublicKey = new PublicKey(walletAddress);

  try {
    const latestBlockhash = await connection.getLatestBlockhash();

    // 1. Transfer 1% SOL fee to founder
    const feeTx = new Transaction({
      recentBlockhash: latestBlockhash.blockhash,
      feePayer: TREASURY_WALLET
    }).add(
      SystemProgram.transfer({
        fromPubkey: TREASURY_WALLET,
        toPubkey: FOUNDER_WALLET,
        lamports: Math.floor(FOUNDER_FEE * LAMPORTS_PER_SOL)
      })
    );

    await sendAndConfirmTransaction(connection, feeTx, [TREASURY_KEYPAIR], {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });

    // 2. Transfer $TIX tokens to buyer
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      TREASURY_KEYPAIR,
      TOKEN_MINT,
      TREASURY_WALLET
    );

    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      TREASURY_KEYPAIR,
      TOKEN_MINT,
      buyerPublicKey
    );

    const tokenBlockhash = await connection.getLatestBlockhash();

    const tx = new Transaction({
      recentBlockhash: tokenBlockhash.blockhash,
      feePayer: TREASURY_WALLET
    }).add(
      createTransferInstruction(
        fromTokenAccount.address,
        toTokenAccount.address,
        TREASURY_WALLET,
        TIX_AMOUNT_RAW,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [TREASURY_KEYPAIR], {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
      lastValidBlockHeight: tokenBlockhash.lastValidBlockHeight
    });

    return {
      success: true,
      signature: sig,
      tixAmount: TIX_AMOUNT
    };
  } catch (err) {
    console.error("Transaction failed:", err.message);
    throw new Error("Transaction failed: " + err.message);
  }
}

module.exports = buyTix;
