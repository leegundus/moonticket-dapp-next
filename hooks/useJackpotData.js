import { useState, useEffect } from "react";
import { PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

const TREASURY_WALLET = new PublicKey("FrAvtjXo5JCsWrjcphvWCGQDrXX8PuEbN2qu2SGdvurG");

export default function useJackpotData() {
  const [jackpot, setJackpot] = useState(null);

  useEffect(() => {
    const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=47d9c64e-1d5a-4623-abaf-ee532aca9eaa");

    const fetchJackpot = async () => {
      try {
        const balance = await connection.getBalance(TREASURY_WALLET);
        const sol = (balance / LAMPORTS_PER_SOL) * 0.8; // 80% goes to winner
        console.log("Jackpot balance (SOL):", sol);
        setJackpot({ jackpotSol: sol });
      } catch (err) {
        console.error("Failed to fetch treasury balance:", err);
      }
    };

    fetchJackpot(); // initial fetch

    const interval = setInterval(fetchJackpot, 15000); // refresh every 15s

    return () => clearInterval(interval);
  }, []);

  return jackpot;
}
