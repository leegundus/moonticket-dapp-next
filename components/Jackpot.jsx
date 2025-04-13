import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import useBalances from "../hooks/useBalances";
import useJackpotData from "../hooks/useJackpotData";
import useCountdown from "../hooks/useCountdown";
import useEntries from "../hooks/useEntries";
import TweetEntryModal from "./TweetEntryModal";

export default function Jackpot() {
  const { publicKey } = useWallet();
  const { solBalance, tixBalance } = useBalances();
  const jackpot = useJackpotData();
  const { moonCountdown, nextMoonDrawDate } = useCountdown();

  const entryData = useEntries(publicKey);
  const weeklyTix = entryData?.weeklyTix || 0;
  const entries = entryData?.weeklyEntries || 0;
  const purchaseEntries = entryData?.purchaseEntries || 0;
  const tweetEntries = entryData?.tweetEntries || 0;

  const jackpotSol = jackpot?.jackpotSol || 0;

  const [solPrice, setSolPrice] = useState(0);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch("/api/prices");
        const data = await res.json();
        setSolPrice(data.solPriceUsd || 0);
      } catch (err) {
        console.error("Failed to fetch SOL price:", err);
      }
    };
    fetchPrice();
  }, []);

  const jackpotUsd = jackpotSol * solPrice;

  const [showFreeModal, setShowFreeModal] = useState(false);

  return (
    <div className="bg-black text-yellow-400 min-h-screen p-6 flex flex-col items-center text-center">
      <h1 className="text-3xl font-bold mb-6">Moonticket Jackpot</h1>

      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Current Jackpot</h2>
        <p className="text-xl">
          {jackpotSol.toFixed(4)} SOL (~$
          {solPrice > 0 ? jackpotUsd.toFixed(2) : '...'} USD)
        </p>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Next Moon Draw</h2>
        <p><strong>Next Draw:</strong> {nextMoonDrawDate}</p>
        <p><strong>Countdown:</strong> {moonCountdown}</p>
      </div>

      {publicKey ? (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Your Info This Week</h2>
          <p><strong>$TIX Purchased:</strong> {weeklyTix.toLocaleString()} $TIX</p>
          <p><strong>Your Entries:</strong> {entries.toFixed(2)} (Purchased: {purchaseEntries.toFixed(2)}, Tweets: {tweetEntries})</p>
          <p><strong>$TIX Balance:</strong> {tixBalance?.toLocaleString()} $TIX</p>
          <p><strong>SOL Balance:</strong> {Number(solBalance)?.toFixed(4)} SOL</p>
        </div>
      ) : (
        <p>Connect wallet to see your entries.</p>
      )}

      {/* Free TIX Tweet Button */}
      <div className="mt-6 text-center">
        <img
          src="/freeTix-button.png"
          alt="Claim Free Entry"
          className="mx-auto cursor-pointer hover:scale-105 transition"
          onClick={() => setShowFreeModal(true)}
        />
      </div>

      <TweetEntryModal
        isOpen={showFreeModal}
        onClose={() => setShowFreeModal(false)}
        isBonus={false}
      />
    </div>
  );
}
