// pages/api/finalizeCheckin.js

import { createClient } from '@supabase/supabase-js';
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  clusterApiUrl
} from '@solana/web3.js';
import base58 from 'bs58';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl('mainnet-beta'));
const MINT_AUTHORITY = Keypair.fromSecretKey(base58.decode(process.env.TIX_MINT_AUTHORITY_SECRET));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { wallet, serializedTx, streak } = req.body;
  if (!wallet || !serializedTx || !streak) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const userPublicKey = new PublicKey(wallet);
    const txBuffer = Buffer.from(serializedTx, 'base64');
    const transaction = Transaction.from(txBuffer);

    transaction.partialSign(MINT_AUTHORITY);

    const txid = await sendAndConfirmTransaction(connection, transaction, [MINT_AUTHORITY]);

    await supabase
      .from('daily_checkins')
      .update({
        last_checkin: new Date().toISOString(),
        streak_count: streak,
      })
      .eq('wallet', wallet);

    return res.status(200).json({ success: true, txid });
  } catch (e) {
    console.error('❌ finalizeCheckin failed:', e.message);
    return res.status(500).json({ error: 'Check-in finalization failed', detail: e.message });
  }
}

