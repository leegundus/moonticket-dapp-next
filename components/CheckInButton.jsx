import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

export default function CheckInButton() {
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(null);
  const [tixAwarded, setTixAwarded] = useState(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [error, setError] = useState(null);

  const ensureUserHasATA = async () => {
    const connection = new Connection(RPC_URL);
    const userATA = await getAssociatedTokenAddress(
      TIX_MINT,
      publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(userATA);
    if (!accountInfo) {
      console.log("🔧 Creating ATA for user:", userATA.toBase58());

      const ataIx = createAssociatedTokenAccountInstruction(
        publicKey, // payer
        userATA,
        publicKey,
        TIX_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const tx = new Transaction().add(ataIx);
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const txSig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(txSig, "confirmed");

      console.log("✅ ATA created:", txSig);
    } else {
      console.log("ℹ️ ATA already exists:", userATA.toBase58());
    }
  };

  const handleCheckIn = async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    setAlreadyCheckedIn(false);
    setTixAwarded(null);

    try {
      await ensureUserHasATA();

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      const data = await res.json();
      console.log("🎯 Check-in response:", data);

      if (data.alreadyCheckedIn) {
        setAlreadyCheckedIn(true);
      } else if (data.success) {
        setStreak(data.streak);
        setTixAwarded(data.tixAwarded);
      } else {
        setError(data.error || "Check-in failed.");
      }
    } catch (err) {
      console.error("❌ Check-in error:", err);
      setError("Unexpected error occurred.");
    }

    setLoading(false);
  };

  return (
    <div className="text-center mt-6">
      {!publicKey ? (
        <p className="text-yellow-400">Connect your wallet to check in.</p>
      ) : (
        <>
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="bg-yellow-400 text-black px-6 py-2 rounded hover:scale-105 transition font-semibold"
          >
            {loading ? "Checking in..." : "Daily Check-In"}
          </button>

          {alreadyCheckedIn && (
            <p className="mt-3 text-yellow-300">You’ve already checked in today.</p>
          )}

          {tixAwarded && (
            <p className="mt-3 text-green-400">
              ✅ Check-in complete! You earned {tixAwarded} TIX (Streak: {streak} day{streak > 1 ? "s" : ""})
            </p>
          )}

          {error && (
            <p className="mt-3 text-red-400">Error: {error}</p>
          )}
        </>
      )}
    </div>
  );
}

