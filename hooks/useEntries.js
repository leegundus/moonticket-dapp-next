import { useState, useEffect } from "react";

console.log("useEntries hook loaded");

export default function useEntries(publicKey) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    if (!publicKey) {
      console.log("useEntries: Wallet not connected — skipping fetch");
      return;
    }

    console.log("useEntries: Wallet connected!", publicKey.toBase58());

    const fetchEntries = async () => {
      try {
        const res = await fetch(`/api/userEntries?wallet=${publicKey.toBase58()}`);
        const data = await res.json();

        if (!res.ok) {
          console.error("Error fetching entries:", data.error);
          return;
        }

        console.log("Supabase data received:", data);

        const purchaseEntries = data.weeklyEntries || 0;
        const tweetEntries = data.tweetEntries || 0;

        setEntries({
          weeklyTix: data.weeklyTix,
          purchaseEntries,
          tweetEntries,
          weeklyEntries: purchaseEntries + tweetEntries,
        });
      } catch (err) {
        console.error("Failed to load user entries:", err.message);
      }
    };

    console.log("Fetching from /api/userEntries with wallet:", publicKey.toBase58());
    fetchEntries();
  }, [publicKey]);

  return entries;
}
