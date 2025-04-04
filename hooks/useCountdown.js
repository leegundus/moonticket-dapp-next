import { useState, useEffect } from "react";

function formatCountdown(seconds) {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / (60 * 60 * 24));
  const h = Math.floor((seconds % (60 * 60 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

export default function useCountdown() {
  const [moonCountdown, setMoonCountdown] = useState("Loading...");
  const [nextMoonDrawDate, setNextMoonDrawDate] = useState("Loading...");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const currentHour = now.getHours();

      let daysUntilMonday = (1 - currentDay + 7) % 7;
      if (daysUntilMonday === 0 && currentHour >= 22) {
        daysUntilMonday = 7;
      }

      const nextDraw = new Date();

      function formatWithTimezone(date) {
        const options = {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZoneName: "short",
        };

        return date.toLocaleString(undefined, options);
      }

      nextDraw.setDate(now.getDate() + daysUntilMonday);
      nextDraw.setHours(22, 0, 0, 0); // 10pm CT

      const secondsUntilDraw = Math.floor((nextDraw.getTime() - now.getTime()) / 1000);

      setMoonCountdown(formatCountdown(secondsUntilDraw));
      setNextMoonDrawDate(formatWithTimezone(nextDraw));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    moonCountdown,
    nextMoonDrawDate,
  };
}
