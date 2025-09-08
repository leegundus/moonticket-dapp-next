const { Connection, PublicKey } = require("@solana/web3.js");
const { createClient } = require("@supabase/supabase-js");

function validateTickets(tickets) {
  if (!Array.isArray(tickets) || !tickets.length) return "No tickets";
  for (const t of tickets) {
    const nums = [t?.num1, t?.num2, t?.num3, t?.num4];
    if (nums.some(n => !Number.isInteger(n) || n < 1 || n > 25)) return "Main numbers must be 1–25 integers";
    if (new Set(nums).size !== 4) return "Main numbers must be unique";
    if (!Number.isInteger(t?.moonball) || t.moonball < 1 || t.moonball > 10) return "Moonball must be 1–10 integer";
  }
  return null;
}

module.exports = async function handler(req, res) {
  // CORS + JSON
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try {
    const { wallet, signature, tickets, expectedTotalBase = 0, lockedCredits = 0 } = req.body || {};
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });
    const v = validateTickets(tickets);
    if (v) return res.status(400).json({ ok:false, error: v });

    const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
    const TIX_MINT = process.env.TIX_MINT;
    const TREASURY_PUB = new PublicKey(process.env.TREASURY_PUBLIC_KEY);

    if (!RPC_URL || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !TIX_MINT) {
      return res.status(500).json({ ok:false, error:"Server misconfigured (env)" });
    }

    const connection = new Connection(RPC_URL, "confirmed");
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Verify payment if expected
    if (Number(expectedTotalBase) > 0) {
      if (!signature) return res.status(400).json({ ok:false, error:"Missing signature" });

      const parsed = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
      if (!parsed) return res.status(400).json({ ok:false, error:"Transaction not found" });

      const pre = parsed.meta?.preTokenBalances || [];
      const post = parsed.meta?.postTokenBalances || [];

      const preBal = pre.find(b => b.mint === TIX_MINT && b.owner === TREASURY_PUB.toBase58());
      const postBal = post.find(b => b.mint === TIX_MINT && b.owner === TREASURY_PUB.toBase58());
      if (!postBal) return res.status(400).json({ ok:false, error:"Treasury TIX balance not present in tx" });

      const credited =
        BigInt(postBal.uiTokenAmount.amount) - BigInt(preBal ? preBal.uiTokenAmount.amount : "0");

      if (credited !== BigInt(expectedTotalBase)) {
        return res.status(400).json({
          ok:false,
          error:`Amount mismatch. Expected ${expectedTotalBase}, got ${credited.toString()}`
        });
      }
    }

    // Latest draw
    const { data: lastDraw, error: de } = await supabase
      .from("draws").select("id")
      .order("draw_time", { ascending: false })
      .limit(1).maybeSingle();
    if (de) return res.status(500).json({ ok:false, error: de.message });
    const drawId = lastDraw?.id || null;

    // Consume credits
    let creditTypes = [];
    if (Number(lockedCredits) > 0) {
      const { data: creditsRows, error: ce } = await supabase
        .from("pending_tickets")
        .select("id,ticket_type")
        .eq("wallet", wallet)
        .eq("is_redeemed", true)
        .eq("is_consumed", false)
        .eq("draw_id", drawId)
        .order("created_at", { ascending: true })
        .limit(Number(lockedCredits));
      if (ce) return res.status(500).json({ ok:false, error: ce.message });
      if (!creditsRows || creditsRows.length < Number(lockedCredits)) {
        return res.status(400).json({ ok:false, error:"Insufficient credits" });
      }

      const ids = creditsRows.map(r => r.id);
      creditTypes = creditsRows.map(r => r.ticket_type || "promo");

      const { error: ue } = await supabase
        .from("pending_tickets")
        .update({ is_consumed: true })
        .in("id", ids);
      if (ue) return res.status(500).json({ ok:false, error: ue.message });
    }

    // Insert entries (credits first, then paid)
    const c = Number(lockedCredits);
    const creditEntries = tickets.slice(0, c).map((t, i) => ({
      wallet,
      entry_type: creditTypes[i] || "promo",
      num1: t.num1, num2: t.num2, num3: t.num3, num4: t.num4, moonball: t.moonball,
    }));
    const paidEntries = tickets.slice(c).map(t => ({
      wallet,
      entry_type: "purchase",
      num1: t.num1, num2: t.num2, num3: t.num3, num4: t.num4, moonball: t.moonball,
    }));
    const rows = [...creditEntries, ...paidEntries];

    const { error: insErr } = await supabase.from("entries").insert(rows);
    if (insErr) return res.status(500).json({ ok:false, error: insErr.message });

    return res.status(200).json({ ok:true, inserted: rows.length });
  } catch (e) {
    console.error("powerballEntryFinalize error:", e);
    return res.status(500).json({ ok:false, error: e.message || "Server error" });
  }
};
