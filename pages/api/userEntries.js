const TIME_ZONE = "America/Chicago";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/$/, ""), serviceRoleKey };
}

function isValidSolanaAddress(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

async function supabaseRequest(path) {
  const config = getSupabaseConfig();
  if (!config) {
    const err = new Error("MoonTicket preview database connection is not configured.");
    err.code = "SUPABASE_PREVIEW_ENV_MISSING";
    throw err;
  }

  const response = await fetch(config.url + "/rest/v1/" + path, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: "Bearer " + config.serviceRoleKey,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const err = new Error(
      (body && typeof body === "object" && (body.message || body.error)) ||
        "Supabase request failed"
    );
    err.status = response.status;
    err.details = body;
    throw err;
  }

  return body;
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

  if (p.weekday === "Mon" && p.hour < 22) daysBack += 7;

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
  if (!wallet) return res.status(400).json({ error: "Missing wallet parameter" });
  if (!isValidSolanaAddress(wallet)) {
    return res.status(400).json({ error: "Invalid Solana wallet" });
  }

  try {
    const { start, end } = getDrawWindow();
    const query = new URLSearchParams({
      select: "entries",
      wallet: "eq." + wallet,
      entry_type: "eq.free",
      created_at: "gte." + start.toISOString(),
    });
    query.append("created_at", "lt." + end.toISOString());

    const rows = await supabaseRequest("entries?" + query.toString());
    const freeEntries = Array.isArray(rows) && rows.length > 0 ? 1 : 0;

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
    console.error("userEntries error:", err?.message, err?.details || "");

    if (err?.code === "SUPABASE_PREVIEW_ENV_MISSING") {
      return res.status(503).json({ error: err.message, code: err.code });
    }

    return res.status(500).json({
      error: "Failed to fetch weekly entry.",
      code: "ENTRY_LOOKUP_ERROR",
    });
  }
}
