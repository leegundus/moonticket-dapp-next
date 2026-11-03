import { useEffect, useState } from "react";

export default function useEntries(publicKey) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    if (!publicKey) {
      setEntries(null);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/userEntries?wallet=" + publicKey.toBase58());
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load entries");
        if (!cancelled) setEntries(data);
      } catch (err) {
        console.error("Failed to load weekly entry:", err);
        if (!cancelled) setEntries({ freeEntries: 0, weeklyEntries: 0, hasFreeEntry: false });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  return entries;
}
