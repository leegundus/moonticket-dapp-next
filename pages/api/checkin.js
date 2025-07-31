import { createClient } from '@supabase/supabase-js';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import base58 from 'bs58';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl('mainnet-beta'));
const MINT_AUTHORITY = Keypair.fromSecretKey(base58.decode(process.env.TIX_MINT_AUTHORITY_SECRET));
const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);
const DECIMALS = 6;

const rewards = [0, 50, 50, 100, 200, 300, 500, 1000]; // Index 1–7

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'Wallet address is required' });

  const userWallet = new PublicKey(wallet);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let streak = 1;
  let alreadyCheckedIn = false;

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
      alreadyCheckedIn = true;
    }
  }

  if (alreadyCheckedIn) {
    return res.status(200).json({ alreadyCheckedIn: true, streak: data.streak_count });
  }

  try {
    const tixAmount = BigInt(rewards[streak]) * BigInt(10 ** DECIMALS);
    const userATA = await getAssociatedTokenAddress(TIX_MINT, userWallet);

    const tx = new Transaction();
    const ataInfo = await connection.getAccountInfo(userATA);

    if (!ataInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          userWallet,       // payer (user pays for ATA)
          userATA,
          userWallet,
          TIX_MINT
        )
      );
    }

    tx.add(
      createMintToInstruction(
        TIX_MINT,
        userATA,
        MINT_AUTHORITY.publicKey,
        tixAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userWallet;
    tx.partialSign(MINT_AUTHORITY);

    const serialized = tx.serialize({ requireAllSignatures: false });
    const base64tx = serialized.toString('base64');

    return res.status(200).json({
      success: true,
      streak,
      tixAwarded: rewards[streak],
      transaction: base64tx,
      lastValidBlockHeight,
    });

  } catch (e) {
    console.error("❌ MintTo failed:", e.message);
    return res.status(500).json({ error: 'Mint failed', detail: e.message });
  }
}

