import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, Transaction } from "@solana/web3.js";
import { TIX_MINT, RPC_URL } from "../lib/constants";

const connection = new Connection(RPC_URL);

export default function CheckInButton({ streak, lastCheckin }) {
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  const handleCheckIn = async () => {
    if (!publicKey) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-in failed");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));

      // DO NOT MODIFY tx to avoid Phantom malicious warning
      const signedTx = await signTransaction(tx);
      const txid = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(txid, "confirmed");

      // Confirm in Supabase only after successful send
      await fetch("/api/checkin-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          streak: data.streak,
        }),
      });

      setConfirmed(true);
    } catch (err) {
      console.error("Check-in error:", err);
      setError("Check-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  const last = new Date(lastCheckin);
  const sameDay =
    today.toDateString() === last.toDateString() || confirmed;

  return (
    <div className="mt-4 text-center">
      <button
        onClick={handleCheckIn}
        disabled={loading || sameDay}
        className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 px-6 rounded disabled:opacity-40"
      >
        {loading
          ? "Checking in..."
          : sameDay
          ? "Already Checked In"
          : "Daily Check-In"}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
      {confirmed && <p className="text-green-500 mt-2">✅ Check-in complete!</p>}
    </div>
  );
}
