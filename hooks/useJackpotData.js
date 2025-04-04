import { useState, useEffect } from "react";
import { PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

// Constants
const JACKPOT_PDA = new PublicKey("3z32sBrwkKD7BUdPQJJ7FV5Mu9hHxK1YFgFPzMKdFuSk");
const TIX_PRICE_USD = 0.00001; // Live price logic can be added later
const USD_PER_ENTRY = 1;

export default function useJackpotData() {
  const [jackpot, setJackpot] = useState(null);

  useEffect(() => {
    const fetchJackpot = async () => {
      try {
        const connection = new Connection("https://api.devnet.solana.com");
        const accountInfo = await connection.getAccountInfo(JACKPOT_PDA);

        if (!accountInfo || !accountInfo.data) {
          console.error("No jackpot account data found.");
          return;
        }

        const data = accountInfo.data;

        const totalWeeklyTixRaw = Number(data.readBigUInt64LE(0)); // Raw amount in lamports (9 decimals)
        const lastMoonDraw = Number(data.readBigInt64LE(16));
        const lastMoonWinner = new PublicKey(data.slice(24, 56)).toBase58();
        const moonRolled = !!data[88];

        const lamports = accountInfo.lamports;
        const moonJackpotSol = lamports / LAMPORTS_PER_SOL;

        // Convert raw $TIX amount to USD value
        const tixAmount = totalWeeklyTixRaw / 1e9;
        const usdSpent = tixAmount * TIX_PRICE_USD;

        // 1 entry per $1 spent
        const estimatedEntries = Math.floor(usdSpent / USD_PER_ENTRY);

        setJackpot({
          totalWeeklyTixRaw,
          estimatedEntries,
          lastMoonDraw,
          lastMoonWinner,
          moonRolled,
          moonJackpotSol,
          pdaLamports: lamports,
        });
      } catch (err) {
        console.error("Error fetching jackpot data:", err);
      }
    };

    fetchJackpot();
  }, []);

  return jackpot;
}
