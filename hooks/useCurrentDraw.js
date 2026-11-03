import { useEffect, useState } from "react";

export default function useCurrentDraw() {
  const [state, setState] = useState({ loading: true, draw: null, window: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/currentDraw");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Could not load drawing");
        if (!cancelled) setState({ loading: false, draw: data.draw || null, window: data.window || null });
      } catch (err) {
        console.error("Current drawing load failed:", err);
        if (!cancelled) setState({ loading: false, draw: null, window: null });
      }
    }
    load();
    const timer = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return state;
}
