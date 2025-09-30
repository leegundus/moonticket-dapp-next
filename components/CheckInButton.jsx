import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, Transaction, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
const rewardByDay = [50, 50, 100, 200, 300, 500, 1000];
const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);

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
      // ---------- Preflight: make sure user can afford ATA rent (+fees) ----------
      const balanceLamports = await connection.getBalance(publicKey);

      // does the user already have a TIX ATA?
      const userAta = await getAssociatedTokenAddress(TIX_MINT, publicKey);
      const ataInfo = await connection.getAccountInfo(userAta);
      const ataRentLamports = ataInfo
        ? 0
        : await connection.getMinimumBalanceForRentExemption(165); // SPL token account size

      // estimate base fee for a small tx (1–2 sigs). Use empty message as baseline.
      let feeLamports = 5000; // fallback
      try {
        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        const feeProbe = new Transaction({ feePayer: publicKey, recentBlockhash: blockhash });
        const feeRes = await connection.getFeeForMessage(feeProbe.compileMessage());
        feeLamports = typeof feeRes === "number" ? feeRes : (feeRes?.value ?? 5000);
      } catch {}

      // dynamic headroom so Phantom won't flag low-balance sign requests
      const FEE_BUFFER_LAMPORTS = Math.max(300_000, Math.floor(balanceLamports * 0.10));   // ≥0.0003 SOL or 10%
      const MIN_REMAINING_BALANCE_LAMPORTS = Math.max(200_000, Math.floor(balanceLamports * 0.05)); // ≥0.0002 SOL or 5%

      const requiredLamports =
        ataRentLamports + feeLamports + FEE_BUFFER_LAMPORTS + MIN_REMAINING_BALANCE_LAMPORTS;

      if (balanceLamports < requiredLamports) {
        const estFees =
          (ataRentLamports + feeLamports + FEE_BUFFER_LAMPORTS + MIN_REMAINING_BALANCE_LAMPORTS) / 1e9;
        const shortBy = (requiredLamports - balanceLamports) / 1e9;

        alert(
          `Not enough SOL to complete check-in.\n\n` +
          `Estimated network/ATA fees: ~${estFees.toFixed(6)} SOL` +
          `${ataRentLamports ? " (includes ATA rent)" : ""}\n` +
          `Short by: ${shortBy.toFixed(6)} SOL.\n\n` +
          `Top up a little SOL and try again.`
        );
        setLoading(false);
        return;
      }
      // ---------------------------------------------------------------------------

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });

      const data = await res.json();
      if (res.status === 409 || data?.alreadyCheckedIn) {
        setError("You've already checked in today.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Check-in failed");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signedTx = await signTransaction(tx);

      const finalizeRes = await fetch("/api/finalizeCheckin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Tx: signedTx.serialize({ requireAllSignatures: false }).toString("base64"),
        }),
      });

      const finalizeData = await finalizeRes.json();
      if (!finalizeData.success) throw new Error(finalizeData.error || "Finalization failed");

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
      setError("Check-in failed. Try again.");
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
