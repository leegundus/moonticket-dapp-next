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
        console.log("useEffect triggered with publicKey:", publicKey);

        if (!res.ok) {
          console.error("Error fetching entries:", data.error);
          return;
        }

        console.log("Supabase data received:", data);

        // This matches exactly what your API returns
        setEntries({
          weeklyTix: data.weeklyTix,
          weeklyUsd: data.weeklyUsd,
          weeklyEntries: data.weeklyEntries,
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
