import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { wallet } = req.query;

  if (!wallet) {
    return res.status(400).json({ error: "Missing wallet parameter" });
  }

  try {
    // Get most recent moon draw
    const { data: draws, error: drawError } = await supabase
      .from("draws")
      .select("draw_date")
      .eq("draw_type", "moon")
      .order("draw_date", { ascending: false })
      .limit(1);

    if (drawError) {
      console.error("Draw lookup failed:", drawError.message);
      return res.status(500).json({ error: "Failed to fetch latest draw" });
    }

    const lastDrawDate = draws?.[0]?.draw_date;
    const since = lastDrawDate ? new Date(lastDrawDate) : null;

    console.log("=== User Entry Query ===");
    console.log("Wallet:", wallet);
    console.log("Since:", since?.toISOString() || "All time (no draws yet)");
    console.log("========================");

    // Fetch all entries for wallet
    const { data: allRows, error: allError } = await supabase
      .from("entries")
      .select("*")
      .eq("wallet", wallet);

    if (allError) {
      console.error("Supabase query error:", allError.message);
      return res.status(500).json({ error: "Failed to fetch raw data" });
    }

    // Filter by draw timestamp
    const filtered = since
      ? allRows.filter(row => new Date(row.created_at) >= since)
      : allRows;

    let weeklyTix = 0;
    let purchaseEntries = 0;
    let tweetEntries = 0;

    for (const entry of filtered) {
      if (entry.entry_type === "purchase") {
        weeklyTix += entry.tix_amount;
        purchaseEntries += entry.entries;
      } else if (entry.entry_type === "tweet") {
        tweetEntries += entry.entries;
      }
    }

    const weeklyEntries = purchaseEntries + tweetEntries;

    res.status(200).json({
      weeklyTix,
      purchaseEntries,
      tweetEntries,
      weeklyEntries,
      debug: {
        drawSince: since?.toISOString() || null,
        filtered,
        raw: allRows
      }
    });
  } catch (err) {
    console.error("API error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
