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
const TIX_MINT = new PublicKey("8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek");
const PROGRAM_ID = new PublicKey("GmyMFG4QwHh2YK4bjy489eBzf9Hzf3BLZ1sFfznoeWpB");
const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);
const TREASURY_WALLET = TREASURY_KEYPAIR.publicKey;
const TREASURY_ADDRESS = new PublicKey("FrAvtjXo5JCsWrjcphvWCGQDrXX8PuEbN2qu2SGdvurG");

const TIX_PRICE_USD = 0.0001;

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { buyerPublicKeyString, solAmount } = req.body;

    const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=47d9c64e-1d5a-4623-abaf-ee532aca9eaa");
    const buyerPublicKey = new PublicKey(buyerPublicKeyString);

    const priceRes = await fetch("https://moonticket.io/api/prices");
    const priceData = await priceRes.json();
    const solPriceUsd = priceData?.solPriceUsd || 0;

    const usdSpent = solAmount * solPriceUsd;
    const tixAmount = Math.floor(usdSpent / TIX_PRICE_USD);
    const tixAmountRaw = BigInt(tixAmount * 1e9);

    const fromTokenAccount = await getAssociatedTokenAddress(TIX_MINT, TREASURY_WALLET);

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
        entries: usdSpent,
        tix_amount: tixAmount,
        sol_amount: solAmount,
      },
    ]);

    return res.status(200).json({
      success: true,
      tixAmount,
      solAmount,
      usdSpent,
      tixPriceUsd: TIX_PRICE_USD,
      solPriceUsd,
      message: "TIX transferred successfully. SOL handled by frontend.",
    });
  } catch (err) {
    console.error("BuyTix API error:", err);
    return res.status(500).json({ error: "Internal Server Error", detail: err.message });
  }
}
