import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getDrawWindowUTC() {
  const now = new Date();

  // Convert to Central Time (UTC-6)
  const utcOffset = now.getTimezoneOffset(); // e.g. 300 minutes
  const centralOffset = 6 * 60;
  const diffMinutes = centralOffset - utcOffset;
  const nowCentral = new Date(now.getTime() + diffMinutes * 60000);

  // Last Monday at 10pm CT
  const day = nowCentral.getDay();
  const diffToMonday = (day + 6) % 7;
  const lastMonday = new Date(
    nowCentral.getFullYear(),
    nowCentral.getMonth(),
    nowCentral.getDate() - diffToMonday,
    22, 0, 0
  );

  // If still Monday but before 10pm CT, go back one week
  if (day === 1 && nowCentral.getHours() < 22) {
    lastMonday.setDate(lastMonday.getDate() - 7);
  }

  const nextMonday = new Date(lastMonday.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    startISO: new Date(lastMonday.getTime() + utcOffset * 60000).toISOString(),
    endISO: new Date(nextMonday.getTime() + utcOffset * 60000).toISOString(),
  };
}

export default async function handler(req, res) {
  const { wallet } = req.query;

  if (!wallet) {
    return res.status(400).json({ error: "Missing wallet parameter" });
  }

  const { startISO, endISO } = getDrawWindowUTC();

  try {
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .eq("wallet", wallet)
      .gte("created_at", startISO)
      .lt("created_at", endISO);

    if (error) {
      console.error("Supabase query error:", error.message);
      return res.status(500).json({ error: "Failed to fetch data" });
    }

    let weeklyTix = 0;
    let weeklyUsd = 0;
    let weeklyEntries = 0;

    for (const entry of data) {
      weeklyTix += entry.tix_amount;
      weeklyUsd += entry.amount_usd;
      weeklyEntries += entry.entries;
    }

    res.status(200).json({ weeklyTix, weeklyUsd, weeklyEntries });
  } catch (err) {
    console.error("API error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
