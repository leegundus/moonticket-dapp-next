import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok:false, error:"Method not allowed" });
  try {
    const wallet = req.query.wallet;
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });

    const { data, error } = await supabase
      .from("pending_tickets")
      .select("balance")
      .eq("wallet", wallet)
      .maybeSingle();

    if (error) return res.status(500).json({ ok:false, error: error.message });

    return res.status(200).json({ ok:true, credits: Number(data?.balance || 0) });
  } catch (e) {
    console.error("ticketCredits error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
