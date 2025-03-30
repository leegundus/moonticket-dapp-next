import React, { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import useBalances from "../hooks/useBalances";

export default function Jackpot() {
  const { publicKey } = useWallet();
  const { solBalance, tixBalanceRaw, tixBalance } = useBalances();
  const [hodlInfo, setHodlInfo] = useState(null);

  useEffect(() => {
    console.log("Running useEffect...");
    console.log("publicKey:", publicKey?.toString());
    console.log("tixBalanceRaw:", tixBalanceRaw);

    if (!publicKey || !tixBalanceRaw) {
      console.log("Missing publicKey or tixBalanceRaw. Skipping fetch.");
      return;
    }

    const fetchHodlInfo = async () => {
      try {
        const res = await fetch("/api/userHodlInfo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: publicKey.toString(),
            tixBalanceRaw,
          }),
        });
        const data = await res.json();
        console.log("HODL info response:", data);
        setHodlInfo(data);
      } catch (err) {
        console.error("Error fetching HODL info:", err);
      }
    };

    fetchHodlInfo();
  }, [publicKey, tixBalanceRaw]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Moonticket Jackpot</h1>
      <p><strong>SOL Balance:</strong> {Number(solBalance)?.toFixed(4)} SOL</p>
      <p><strong>$TIX Balance:</strong> {tixBalance?.toLocaleString()} $TIX</p>

      <hr />

      <h2>Upcoming Jackpots</h2>

      <h3>Moon Draw (Weekly)</h3>
      <p>Next Draw: Saturday @ Midnight UTC</p>
      <p>Jackpot: 100 SOL (~$18,000)</p>

      {!hodlInfo ? (
        <p>Loading HODL info...</p>
      ) : (
        <>
          <p>
            <strong>Required HODL:</strong>{" "}
            {hodlInfo.requiredWeeklyHodl.toLocaleString()} $TIX
          </p>
          <p>
            <strong>Purchased this week:</strong>{" "}
            {hodlInfo.weeklyPurchased.toLocaleString()} $TIX
          </p>
          <p style={{ color: hodlInfo.eligibleForMoon ? "green" : "red" }}>
            {hodlInfo.eligibleForMoon ? "✓ Eligible" : "✗ Ineligible"}
          </p>
          <p>
            <strong>Entries this week:</strong>{" "}
            {hodlInfo.weeklyEntries.toLocaleString()}
          </p>
        </>
      )}

      <br />

      <h3>Mega Moon Draw (Monthly)</h3>
      <p>Next Draw: Every 4th Saturday</p>
      <p>Jackpot: 250 SOL (~$45,000)</p>

      {!hodlInfo ? (
        <p>Loading HODL info...</p>
      ) : (
        <>
          <p>
            <strong>Required HODL (Mega):</strong>{" "}
            {hodlInfo.requiredMonthlyHodl.toLocaleString()} $TIX
          </p>
          <p>
            <strong>Purchased this period:</strong>{" "}
            {hodlInfo.monthlyPurchased.toLocaleString()} $TIX
          </p>
          <p style={{ color: hodlInfo.eligibleForMega ? "green" : "red" }}>
            {hodlInfo.eligibleForMega ? "✓ Eligible" : "✗ Ineligible"}
          </p>
          <p>
            <strong>Entries this period:</strong>{" "}
            {hodlInfo.monthlyEntries.toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
