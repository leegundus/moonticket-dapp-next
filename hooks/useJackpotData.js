import { useState, useEffect } from "react";
import { PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

const TREASURY_WALLET = new PublicKey("FrAvtjXo5JCsWrjcphvWCGQDrXX8PuEbN2qu2SGdvurG");

export default function useJackpotData() {
  const [jackpot, setJackpot] = useState(null);

  useEffect(() => {
    const fetchJackpot = async () => {
      try {
        const connection = new Connection("https://api.devnet.solana.com");
        const balance = await connection.getBalance(TREASURY_WALLET);
        const sol = (balance / LAMPORTS_PER_SOL) * 0.9; //90% goes to winner
        setJackpot({ jackpotSol: sol });
      } catch (err) {
        console.error("Failed to fetch treasury balance:", err);
      }
    };

    fetchJackpot();
  }, []);

  return jackpot;
}
