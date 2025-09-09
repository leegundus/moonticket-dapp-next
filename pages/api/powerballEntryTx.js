import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function validateTickets(tickets){
  if (!Array.isArray(tickets) || !tickets.length) return "No tickets";
  for (const t of tickets) {
    const nums = [t?.num1, t?.num2, t?.num3, t?.num4];
    if (nums.some(n => !Number.isInteger(n) || n<1 || n>25)) return "Main numbers must be 1–25 integers";
    if (new Set(nums).size !== 4) return "Main numbers must be unique";
    if (!Number.isInteger(t?.moonball) || t.moonball<1 || t.moonball>10) return "Moonball must be 1–10 integer";
  }
  return null;
}

export default async function handler(req,res){
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });
  try{
    const { wallet, tickets } = req.body || {};
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });
    const v = validateTickets(tickets);
    if (v) return res.status(400).json({ ok:false, error: v });

    const { data, error } = await supabase
      .from("pending_tickets").select("balance").eq("wallet", wallet).maybeSingle();
    if (error) return res.status(500).json({ ok:false, error: error.message });

    const bal = Number(data?.balance || 0);
    if (tickets.length > bal) {
      return res.status(400).json({ ok:false, error:`Not enough credits. You have ${bal}, need ${tickets.length}.` });
    }

    return res.status(200).json({
      ok:true,
      txBase64: null,
      expectedTotalBase: 0,
      lockedCredits: tickets.length
    });
  }catch(e){
    console.error("powerballEntryTx error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
