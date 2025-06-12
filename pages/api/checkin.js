import { createClient } from '@supabase/supabase-js';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from '@solana/spl-token';
import base58 from 'bs58';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
const REWARDS_SECRET = process.env.REWARDS_SECRET_KEY_BASE58;
const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);
const DECIMALS = 6;

// ✅ Hardcoded Program IDs
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5zWH25efTNsLJA8knL");

const rewards = [0, 50, 50, 100, 200, 300, 500, 1000]; // Index 1–7

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Wallet address is required' });

  const userWallet = new PublicKey(wallet);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let streak = 1;

  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('wallet', wallet)
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: 'Database error', detail: error.message });
  }

  if (data) {
    const lastCheck = new Date(data.last_checkin);
    lastCheck.setUTCHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today - lastCheck) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      streak = Math.min(data.streak_count + 1, 7);
    } else if (daysDiff === 0) {
      return res.status(200).json({ alreadyCheckedIn: true, streak: data.streak_count });
    }

    await supabase
      .from('daily_checkins')
      .update({
        last_checkin: new Date().toISOString(),
        streak_count: streak,
      })
      .eq('wallet', wallet);
  } else {
    await supabase.from('daily_checkins').insert({
      wallet,
      last_checkin: new Date().toISOString(),
      streak_count: 1,
    });
  }

  const tixAmount = BigInt(rewards[streak]) * BigInt(10 ** DECIMALS);
  const rewardsKeypair = Keypair.fromSecretKey(base58.decode(REWARDS_SECRET));
  const rewardsATA = await getAssociatedTokenAddress(
    TIX_MINT,
    rewardsKeypair.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const userATA = await getAssociatedTokenAddress(
    TIX_MINT,
    userWallet,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const ataInfo = await connection.getAccountInfo(userATA);
  const instructions = [];

  if (!ataInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        rewardsKeypair.publicKey,
        userATA,
        userWallet,
        TIX_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  instructions.push(
    createTransferInstruction(
      rewardsATA,
      userATA,
      rewardsKeypair.publicKey,
      tixAmount,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  try {
    const tx = new Transaction().add(...instructions);
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    tx.recentBlockhash = blockhash;
    tx.feePayer = rewardsKeypair.publicKey;
    tx.sign(rewardsKeypair);

    const txSig = await sendAndConfirmTransaction(connection, tx, [rewardsKeypair], {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
      lastValidBlockHeight,
    });

    console.log("✅ Check-in transfer confirmed:", txSig);

    return res.status(200).json({
      success: true,
      streak,
      tixAwarded: rewards[streak],
      txSig,
    });
  } catch (e) {
    console.error("❌ TIX transfer failed:", e.message);
    return res.status(500).json({ error: 'Transfer failed', detail: e.message });
  }
}
