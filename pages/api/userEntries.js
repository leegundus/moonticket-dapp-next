import { createClient } from "@supabase/supabase-js";
import { PublicKey } from "@solana/web3.js";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey);
}

const TIME_ZONE = "America/Chicago";

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

function timeZoneOffsetMs(date) {
  const p = zonedParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

function localCentralToUtc(year, month, day, hour, minute) {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = new Date(wallClock);

  for (let i = 0; i < 3; i += 1) {
    guess = new Date(wallClock - timeZoneOffsetMs(guess));
  }

  return guess;
}

function addCalendarDays(year, month, day, amount) {
  const d = new Date(Date.UTC(year, month - 1, day + amount, 12, 0, 0));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function getDrawWindow(now = new Date()) {
  const p = zonedParts(now);
  const weekdayIndex = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  let daysBack = weekdayIndex[p.weekday] ?? 0;

  if (p.weekday === "Mon" && p.hour < 22) {
    daysBack += 7;
  }

  const startDate = addCalendarDays(p.year, p.month, p.day, -daysBack);
  const endDate = addCalendarDays(startDate.year, startDate.month, startDate.day, 7);

  return {
    start: localCentralToUtc(startDate.year, startDate.month, startDate.day, 22, 0),
    end: localCentralToUtc(endDate.year, endDate.month, endDate.day, 22, 0),
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const wallet = String(req.query?.wallet || "").trim();

  if (!wallet) {
    return res.status(400).json({ error: "Missing wallet parameter" });
  }

  try {
    new PublicKey(wallet);
  } catch {
    return res.status(400).json({ error: "Invalid Solana wallet" });
  }

  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({
        error: "MoonTicket preview database connection is not configured.",
        code: "SUPABASE_PREVIEW_ENV_MISSING",
      });
    }

    const { start, end } = getDrawWindow();

    const { data, error } = await supabase
      .from("entries")
      .select("entry_type,entries,created_at")
      .eq("wallet", wallet)
      .eq("entry_type", "free")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());

    if (error) {
      console.error("Weekly entry lookup failed:", error);
      return res.status(500).json({ error: "Failed to fetch weekly entry" });
    }

    const totalFree = (data || []).reduce((sum, row) => sum + Number(row.entries || 0), 0);
    const freeEntries = totalFree > 0 ? 1 : 0;

    return res.status(200).json({
      freeEntries,
      weeklyEntries: freeEntries,
      hasFreeEntry: freeEntries === 1,
      drawWindow: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (err) {
    console.error("userEntries error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
