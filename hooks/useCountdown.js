import { useState, useEffect } from "react";

const TIME_ZONE = "America/Chicago";

function formatCountdown(seconds) {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d}d ${h}h ${m}m ${s}s`;
}

function zonedParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const out = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }

  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    weekday: out.weekday,
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
  };
}

function offsetMs(date) {
  const p = zonedParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

function centralToUtc(year, month, day, hour, minute) {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = new Date(wallClock);
  for (let i = 0; i < 3; i += 1) {
    guess = new Date(wallClock - offsetMs(guess));
  }
  return guess;
}

function addDays(year, month, day, amount) {
  const d = new Date(Date.UTC(year, month - 1, day + amount, 12, 0, 0));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function nextDrawFrom(now) {
  const p = zonedParts(now);
  const weekdayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let daysUntilMonday = (1 - (weekdayIndex[p.weekday] ?? 0) + 7) % 7;

  if (daysUntilMonday === 0 && p.hour >= 22) {
    daysUntilMonday = 7;
  }

  const date = addDays(p.year, p.month, p.day, daysUntilMonday);
  return centralToUtc(date.year, date.month, date.day, 22, 0);
}

export default function useCountdown() {
  const [moonCountdown, setMoonCountdown] = useState("Loading...");
  const [nextMoonDrawDate, setNextMoonDrawDate] = useState("Loading...");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextDraw = nextDrawFrom(now);
      const secondsUntilDraw = Math.max(0, Math.floor((nextDraw.getTime() - now.getTime()) / 1000));

      setMoonCountdown(formatCountdown(secondsUntilDraw));
      setNextMoonDrawDate(
        new Intl.DateTimeFormat("en-US", {
          timeZone: TIME_ZONE,
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(nextDraw)
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return { moonCountdown, nextMoonDrawDate };
}
