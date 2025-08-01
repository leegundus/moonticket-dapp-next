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
    const { data, error } = await supabase
      .from("daily_checkins")
      .select("streak_count, last_checkin")
      .eq("wallet", wallet)
      .maybeSingle();

    if (error) {
      console.error("Supabase error:", error.message);
      return res.status(500).json({ error: "Database error" });
    }

    if (!data) {
      return res.status(200).json({ streak: 0, lastCheckin: null });
    }

    return res.status(200).json({
      streak: data.streak_count || 0,
      lastCheckin: data.last_checkin || null,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
