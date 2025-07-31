import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);
const TIX_DECIMALS = 6;

const rewards = [0, 50, 50, 100, 200, 300, 500, 1000]; // Index 1–7

export default function CheckInButton({ streak, lastCheckin }) {
  const { publicKey, connected } = useWallet();
  const [checkingIn, setCheckingIn] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(null);
  const [rewardAmount, setRewardAmount] = useState(null);

  const canCheckIn = () => {
    if (!lastCheckin) return true;
    const last = new Date(lastCheckin);
    const now = new Date();
    const diff = now - last;
    return diff >= 24 * 60 * 60 * 1000;
  };

  const handleCheckIn = async () => {
    if (!publicKey || !canCheckIn()) return;

    setCheckingIn(true);
    setError(null);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      const { transaction, streak: newStreak, tixAwarded } = await res.json();

      if (!transaction) throw new Error("No transaction returned");

      const tx = Transaction.from(Buffer.from(transaction, "base64"));
      const signed = await window.solana.signAndSendTransaction(tx);
      const txid = signed?.signature;

      // Wait for confirmation
      const confirmedTx = await new Promise((resolve, reject) => {
        const connection = window.moonConnection;
        const interval = setInterval(async () => {
          const status = await connection.getSignatureStatus(txid);
          if (status?.value?.confirmationStatus === "finalized") {
            clearInterval(interval);
            resolve(true);
          }
        }, 1000);
        setTimeout(() => {
          clearInterval(interval);
          reject(new Error("Transaction not confirmed in time"));
        }, 15000);
      });

      // Confirm success in backend
      await fetch("/api/checkinConfirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      setConfirmed(true);
      setRewardAmount(tixAwarded);
    } catch (err) {
      console.error("❌ Check-in failed:", err);
      setError("Check-in failed. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={handleCheckIn}
        disabled={!connected || checkingIn || !canCheckIn()}
        className="bg-yellow-400 text-black px-6 py-2 rounded font-bold hover:bg-yellow-300 disabled:opacity-50"
      >
        {checkingIn
          ? "Checking in..."
          : confirmed
          ? `✅ Checked in +${rewardAmount} TIX`
          : "Check In"}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
