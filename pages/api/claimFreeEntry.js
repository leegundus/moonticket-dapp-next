import { createClient } from "@supabase/supabase-js";
import { PublicKey } from "@solana/web3.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
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
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const wallet = String(req.body?.wallet || "").trim();

  if (!wallet) {
    return res.status(400).json({ error: "Missing wallet" });
  }

  try {
    new PublicKey(wallet);
  } catch {
    return res.status(400).json({ error: "Invalid Solana wallet" });
  }

  try {
    const { start, end } = getDrawWindow();

    const { data: existing, error: selectError } = await supabase
      .from("entries")
      .select("id")
      .eq("wallet", wallet)
      .eq("entry_type", "free")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .limit(1);

    if (selectError) {
      console.error("Free entry lookup failed:", selectError);
      return res.status(500).json({ error: "Could not verify weekly entry" });
    }

    if (existing?.length) {
      return res.status(409).json({
        success: false,
        alreadyClaimed: true,
        error: "You are already entered in this week's drawing.",
      });
    }

    const { error: insertError } = await supabase.from("entries").insert([
      {
        wallet,
        entry_type: "free",
        entries: 1,
        tix_amount: 0,
        is_bonus: false,
      },
    ]);

    if (insertError) {
      console.error("Free entry insert failed:", insertError);
      return res.status(500).json({ error: "Could not save weekly entry" });
    }

    return res.status(200).json({
      success: true,
      entries: 1,
      drawWindow: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (err) {
    console.error("claimFreeEntry error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
