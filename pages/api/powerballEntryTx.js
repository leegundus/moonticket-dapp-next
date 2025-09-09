import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function validateTickets(tickets){
  if (!Array.isArray(tickets) || !tickets.length) return "No tickets";
  for (const t of tickets) {
    const nums = [t?.num1, t?.num2, t?.num3, t?.num4];
    if (nums.some(n => !Number.isInteger(n) || n < 1 || n > 25)) return "Main numbers must be 1–25 integers";
    if (new Set(nums).size !== 4) return "Main numbers must be unique";
    if (!Number.isInteger(t?.moonball) || t.moonball < 1 || t.moonball > 10) return "Moonball must be 1–10 integer";
  }
  return null;
}

export default async function handler(req,res){
  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try{
    const { wallet, tickets, useCredits } = req.body || {};
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });

    const v = validateTickets(tickets);
    if (v) return res.status(400).json({ ok:false, error: v });

    // Read current credit balance (single row per wallet model)
    const { data, error } = await supabase
      .from("pending_tickets")
      .select("balance")
      .eq("wallet", wallet)
      .maybeSingle();

    if (error) return res.status(500).json({ ok:false, error: error.message });

    const bal = Number(data?.balance || 0);

    // How many credits do we intend to apply for this checkout
    const requested = Number.isFinite(Number(useCredits)) ? Number(useCredits) : tickets.length;
    const locked = Math.max(0, Math.min(bal, tickets.length, requested));

    if (locked < tickets.length) {
      // Not enough credits for all tickets; caller will pay remaining with TIX in other flows
      // In this credits-only flow, we error if insufficient
      if (locked === 0) {
        return res.status(400).json({ ok:false, error:`Not enough credits. You have ${bal}, need ${tickets.length}.` , balance: bal });
      }
    }

    return res.status(200).json({
      ok: true,
      txBase64: null,          // no on-chain tx prepared in this credits-only path
      expectedTotalBase: 0,    // nothing to pay in TIX here
      lockedCredits: locked,   // echo what we intend to consume in finalize
      balance: bal,            // for UI refresh if desired
    });
  }catch(e){
    console.error("powerballEntryTx error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
