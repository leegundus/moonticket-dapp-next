import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export default function CheckInButton() {
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [streak, setStreak] = useState(null);
  const [reward, setReward] = useState(null);
  const [message, setMessage] = useState("");

  const rewards = [50, 50, 100, 200, 300, 500, 1000]; // Day 1–7
  const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

  const ensureATAExists = async () => {
    const connection = new Connection(RPC_URL);
    const ata = await getAssociatedTokenAddress(
      TIX_MINT,
      publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const accountInfo = await connection.getAccountInfo(ata);
    if (!accountInfo) {
      const ix = createAssociatedTokenAccountInstruction(
        publicKey, // payer
        ata,
        publicKey, // owner
        TIX_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await signTransaction(tx);
      const txid = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(txid, "confirmed");
    }
  };

  const checkIn = async () => {
    if (!publicKey) return;
    setLoading(true);
    setMessage("");

    try {
      await ensureATAExists();

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      const data = await res.json();

      if (data.success) {
        setStreak(data.streak);
        setReward(data.tixAwarded);
        setMessage(`✅ Successfully checked in! You earned ${data.tixAwarded} TIX.`);
        setAlreadyCheckedIn(true);
      } else if (data.alreadyCheckedIn) {
        setAlreadyCheckedIn(true);
        setStreak(data.streak);
      } else {
        setMessage("❌ Something went wrong. Try again.");
      }
    } catch (e) {
      setMessage("❌ Error: " + e.message);
    }

    setLoading(false);
  };

  useEffect(() => {
    const fetchStatus = async () => {
      if (!publicKey) return;
      try {
        const res = await fetch(`/api/checkin-status?wallet=${publicKey.toBase58()}`);
        const data = await res.json();
        if (data.alreadyCheckedIn) {
          setAlreadyCheckedIn(true);
          setStreak(data.streak);
        } else if (data.streak) {
          setStreak(data.streak);
        }
      } catch (e) {
        console.error("Failed to fetch check-in status:", e.message);
      }
    };
    fetchStatus();
  }, [publicKey]);

  if (!publicKey) return null;

  return (
    <div className="mt-4 text-center">
      {streak !== null && (
        <p className="mb-2 text-sm text-white">
          {alreadyCheckedIn
            ? reward
              ? `✅ Successfully checked in! +${reward} TIX (Day ${streak})`
              : `✅ Checked in today! Streak: Day ${streak}`
            : streak > 1
              ? `🔥 Current Streak: Day ${streak} — Don’t miss today!`
              : null}
        </p>
      )}

      <div className="mb-1 text-xs flex justify-center gap-2 text-white">
        {rewards.map((_, index) => (
          <div key={index} className="w-10 text-center">
            Day {index + 1}
          </div>
        ))}
      </div>

      <div className="text-white text-xs mb-1 font-semibold">TIX Earned</div>

      <div className="flex gap-2 justify-center mb-4">
        {rewards.map((amount, index) => {
          const isChecked = alreadyCheckedIn && streak > index;
          return (
            <div
              key={index}
              className={`w-10 h-10 rounded text-xs flex items-center justify-center font-bold border ${
                isChecked
                  ? "bg-yellow-400 text-black border-yellow-500"
                  : "bg-gray-800 text-white border-gray-600"
              }`}
            >
              {amount}
            </div>
          );
        })}
      </div>

      <button
        onClick={checkIn}
        disabled={loading || alreadyCheckedIn}
        className={`bg-yellow-400 text-black font-bold py-2 px-4 rounded hover:bg-yellow-300 ${
          alreadyCheckedIn ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {loading
          ? "Checking in..."
          : alreadyCheckedIn
          ? "Checked In"
          : "Daily Check-In (+TIX)"}
      </button>

      {message && <p className="mt-2 text-sm text-white">{message}</p>}
    </div>
  );
}
