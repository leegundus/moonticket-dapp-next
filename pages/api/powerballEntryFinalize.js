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
    const { wallet, tickets, lockedCredits = 0 } = req.body || {};
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });
    const v = validateTickets(tickets);
    if (v) return res.status(400).json({ ok:false, error: v });

    const N = Number(lockedCredits || tickets.length);

    // Atomic: decrement if enough balance
    const { data: dec, error: decErr } = await supabase.rpc("exec_sql", {
      q: `
        UPDATE public.pending_tickets
        SET balance = balance - $2, updated_at = now()
        WHERE wallet = $1 AND balance >= $2
        RETURNING balance;
      `,
      params: [wallet, N]
    });
    if (decErr) return res.status(500).json({ ok:false, error: decErr.message });
    if (!dec || dec.length === 0) {
      return res.status(400).json({ ok:false, error:"Insufficient credits (race or mismatch). Please refresh." });
    }

    // Insert entries
    const rows = tickets.map(t => ({
      wallet,
      entry_type: "credit",
      num1: t.num1, num2: t.num2, num3: t.num3, num4: t.num4, moonball: t.moonball,
    }));
    const { error: insErr } = await supabase.from("entries").insert(rows);
    if (insErr) return res.status(500).json({ ok:false, error: insErr.message });

    return res.status(200).json({ ok:true, inserted: rows.length, newBalance: dec[0].balance });
  }catch(e){
    console.error("powerballEntryFinalize error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
