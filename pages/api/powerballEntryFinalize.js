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

    // How many credits to consume
    const N = Number(lockedCredits || tickets.length);
    if (!Number.isFinite(N) || N <= 0) {
      return res.status(400).json({ ok:false, error:"Invalid credit count" });
    }

    // --- Load current balance
    const { data: balRow, error: balErr } = await supabase
      .from("pending_tickets")
      .select("balance")
      .eq("wallet", wallet)
      .maybeSingle();

    if (balErr) return res.status(500).json({ ok:false, error: balErr.message });

    const current = Number(balRow?.balance || 0);
    if (current < N) {
      return res.status(400).json({ ok:false, error:"Insufficient credits (race or mismatch). Please refresh." });
    }

    // --- Optimistic concurrency: set balance to (current - N) iff it is still `current`
    const newBalance = current - N;
    const { data: updRows, error: updErr } = await supabase
      .from("pending_tickets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("wallet", wallet)
      .eq("balance", current)               // compare-and-swap guard
      .select("balance");

    if (updErr) return res.status(500).json({ ok:false, error: updErr.message });
    if (!updRows || updRows.length === 0) {
      // Another request changed the balance between read and write
      return res.status(409).json({ ok:false, error:"Balance changed. Please refresh and try again." });
    }

    // --- Insert entries
    const rows = tickets.map(t => ({
      wallet,
      entry_type: "credit",
      num1: t.num1, num2: t.num2, num3: t.num3, num4: t.num4, moonball: t.moonball,
    }));

    const { error: insErr } = await supabase.from("entries").insert(rows);
    if (insErr) {
      // Best-effort rollback of balance if inserts fail
      await supabase
        .from("pending_tickets")
        .update({ balance: current, updated_at: new Date().toISOString() })
        .eq("wallet", wallet)
        .eq("balance", newBalance);
      return res.status(500).json({ ok:false, error: insErr.message });
    }

    return res.status(200).json({ ok:true, inserted: rows.length, newBalance });
  }catch(e){
    console.error("powerballEntryFinalize error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
}
