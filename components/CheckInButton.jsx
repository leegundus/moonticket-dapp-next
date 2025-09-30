import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, Transaction } from "@solana/web3.js";

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
const rewardByDay = [50, 50, 100, 200, 300, 500, 1000];

export default function CheckInButton({ streak, lastCheckin }) {
  const { publicKey, signTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [reward, setReward] = useState(0);
  const [highlighted, setHighlighted] = useState(0);

  const today = new Date();
  const lastDate = lastCheckin ? new Date(lastCheckin) : null;
  const diffMs = lastDate ? today - lastDate : null;
  const hoursSince = diffMs ? diffMs / (1000 * 60 * 60) : null;
  const sameDay = lastDate && today.toDateString() === lastDate.toDateString();
  const canCheckIn = !sameDay && (!hoursSince || hoursSince >= 24);

  useEffect(() => {
    if (!lastCheckin || typeof streak !== "number") return;
    const now = new Date();
    const last = new Date(lastCheckin);
    const diff = now - last;
    const within24 = diff < 24 * 60 * 60 * 1000;
    setHighlighted(within24 ? streak : Math.max(0, streak - 1));
  }, [streak, lastCheckin]);

  const handleCheckIn = async () => {
    if (!publicKey || !canCheckIn) return;

    setLoading(true);
    setError("");

    try {
      // Ask backend to build the tx (includes: optional user-paid ATA creation + TIX transfer from treasury)
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      const data = await res.json();
      if (res.status === 409 || data?.alreadyCheckedIn) {
        setError("You've already checked in today.");
        setLoading(false);
        return;
      }
      if (!res.ok || !data?.transaction) {
        throw new Error(data?.error || "Check-in failed");
      }

      // IMPORTANT: do not modify feePayer or recentBlockhash here.
      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));

      // User signs once (user is fee payer; also signs ATA create if needed)
      const signedTx = await signTransaction(tx);

      // Send signed tx back to backend so treasury can co-sign and broadcast
      const finalizeRes = await fetch("/api/finalizeCheckin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Tx: signedTx.serialize({ requireAllSignatures: false }).toString("base64"),
        }),
      });

      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok || !finalizeData?.success) {
        throw new Error(finalizeData?.error || "Finalization failed");
      }

      // Mark streak/reward UI
      await fetch("/api/checkinConfirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          streak: data.streak,
        }),
      });

      const rewardAmount = rewardByDay[(data.streak || 1) - 1] || 50;
      setReward(rewardAmount);
      setConfirmed(true);
      setHighlighted(data.streak);
    } catch (err) {
      console.error("Check-in error:", err);
      setError(err?.message || "Check-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 text-center">
      <div className="flex justify-center space-x-2 mb-4">
        {rewardByDay.map((val, index) => (
          <div
            key={index}
            className={`px-3 py-2 rounded ${
              highlighted > index
                ? "bg-yellow-400 text-black font-bold"
                : "bg-gray-800 text-white"
            }`}
          >
            {val}
          </div>
        ))}
      </div>

      <button
        onClick={handleCheckIn}
        disabled={loading || !canCheckIn}
        className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-2 px-6 rounded disabled:opacity-40"
      >
        {loading
          ? "Checking in..."
          : confirmed
          ? "Checked In"
          : sameDay
          ? "Already Checked In"
          : "Daily Check-In (+TIX)"}
      </button>

      {error && <p className="text-red-500 mt-2">{error}</p>}
      {confirmed && (
        <p className="text-green-500 mt-2">
          ✅ Successfully checked in! +{reward} TIX (Day {highlighted})
        </p>
      )}
    </div>
  );
}
