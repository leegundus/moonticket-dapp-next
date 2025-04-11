import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import useBalances from "../hooks/useBalances";
import useJackpotData from "../hooks/useJackpotData";
import useCountdown from "../hooks/useCountdown";
import useEntries from "../hooks/useEntries";

export default function Jackpot() {
  const { publicKey } = useWallet();
  const { solBalance, tixBalance } = useBalances();
  const jackpot = useJackpotData();
  const { moonCountdown, nextMoonDrawDate } = useCountdown();

  const entryData = useEntries(publicKey);
  const weeklyTix = entryData?.weeklyTix || 0;
  const usdSpent = entryData?.weeklyUsd || 0;
  const entries = entryData?.weeklyEntries || 0;

  const jackpotSol = jackpot?.jackpotSol || 0;
  const jackpotUsd = jackpotSol * 180;

  return (
    <div className="bg-black text-yellow-400 min-h-screen p-6 flex flex-col items-center text-center">
      <h1 className="text-3xl font-bold mb-6">Moonticket Jackpot</h1>

      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Current Jackpot</h2>
        <p className="text-xl">{jackpotSol.toFixed(4)} SOL (~${jackpotUsd.toFixed(2)} USD)</p>
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
          <p><strong>USD Spent:</strong> ${usdSpent.toFixed(2)}</p>
          <p><strong>Your Entries:</strong> {entries.toLocaleString()}</p>
          <p><strong>$TIX Balance:</strong> {tixBalance?.toLocaleString()} $TIX</p>
          <p><strong>SOL Balance:</strong> {Number(solBalance)?.toFixed(4)} SOL</p>
        </div>
      ) : (
        <p>Connect wallet to see your entries.</p>
      )}
    </div>
  );
}
