import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import useBalances from "../hooks/useBalances";
import useJackpotData from "../hooks/useJackpotData";
import useCountdown from "../hooks/useCountdown";
import useEntries from "../hooks/useEntries";
import TweetEntryModal from "./TweetEntryModal";

export default function Jackpot() {
  const { publicKey } = useWallet();
  const [walletKey, setWalletKey] = useState(0);
  const jackpot = useJackpotData();
  const { moonCountdown, nextMoonDrawDate } = useCountdown();
  const [solPrice, setSolPrice] = useState(0);
  const [showFreeModal, setShowFreeModal] = useState(false);

  const { solBalance, tixBalance } = useBalances();
  const entryData = useEntries(publicKey);

  const weeklyTix = entryData?.weeklyTix || 0;
  const entries = entryData?.weeklyEntries || 0;
  const purchaseEntries = entryData?.purchaseEntries || 0;
  const tweetEntries = entryData?.tweetEntries || 0;

  const jackpotSol = jackpot?.jackpotSol || 0;
  const jackpotUsd = jackpotSol * solPrice;

  useEffect(() => {
    const hasReloaded = sessionStorage.getItem("walletReloaded");
    if (typeof window !== "undefined" && window.solana?.isConnected && !publicKey && !hasReloaded) {
      console.log("Re-entered Jackpot with connected wallet but no publicKey — reloading...");
      sessionStorage.setItem("walletReloaded", "true");
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    if (publicKey) {
      setWalletKey((prev) => prev + 1);
    }
  }, [publicKey]);

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

  return (
    <div className="bg-black text-yellow-400 min-h-screen p-6 flex flex-col items-center text-center pt-40">
      <h1 className="text-3xl font-bold mb-6">Moonticket Jackpot</h1>

      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Current Jackpot</h2>
        <p className="text-xl">
          {jackpotSol.toFixed(4)} SOL (~${solPrice > 0 ? jackpotUsd.toFixed(2) : "..."} USD)
        </p>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Next Moon Draw</h2>
        <p><strong>Next Draw:</strong> {nextMoonDrawDate}</p>
        <p><strong>Countdown:</strong> {moonCountdown}</p>
      </div>

      <div key={walletKey}>
        {publicKey ? (
          <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Your Info This Week</h2>
          <p><strong>TIX Purchased:</strong> {weeklyTix.toLocaleString()} TIX</p>
          <p><strong>Your Entries:</strong> {entries.toFixed(2)} (Purchased: {purchaseEntries.toFixed(2)}, Tweets: {tweetEntries})</p>
          <hr className="my-4 border-yellow-400 w-full max-w-md sm:max-w-lg md:max-w-2x1 mx-auto" />
          <h3 className="text-lg font-semibold mb-2">Wallet Balances</h3>
          <p><strong>TIX:</strong> {tixBalance?.toLocaleString()} TIX</p>
          <p><strong>SOL:</strong> {Number(solBalance)?.toFixed(4)} SOL</p>
        </div>
      ) : (
        <>
          <p>
            {typeof window !== "undefined" && window?.solana?.isConnected && !publicKey
              ? "Wallet connected."
              : "Connect wallet to see your entries."}
          </p>

          {typeof window !== "undefined" &&
            window?.solana?.isConnected &&
            !publicKey && (
              <img
                src="/load-data-button.png"
                alt="Load Wallet Data"
                className="w-96 h-auto mx-auto mt-4 cursor-pointer hover:scale-105 transition"
                onClick={() => window.location.reload()}
              />
            )}
         </>
       )}
     </div>

      <div className="mt-6 text-center">
        <img
          src="/freeTix-button.png"
          alt="Claim Free Entry"
          className="mx-auto cursor-pointer hover:scale-105 transition"
          onClick={() => setShowFreeModal(true)}
        />
      </div>

      <div className="mt-12 text-center px-4">
        <p className="text-xs text-yellow-400 max-w-2xl mx-auto whitespace-pre-line leading-relaxed">
          No purchase necessary to enter or win. Free entry available via social media. 
          Moonticket is not a financial instrument, investment product, or security. 
          This is a promotional sweepstakes for entertainment purposes only.
          Void where prohibited. Participation is not permitted in jurisdictions where 
          local, state, or national laws restrict or prohibit such activity.
        </p>
      </div>

      <TweetEntryModal
        isOpen={showFreeModal}
        onClose={() => setShowFreeModal(false)}
        isBonus={false}
      />
    </div>
  );
}
