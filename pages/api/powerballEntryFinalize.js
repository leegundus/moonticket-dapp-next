import { Connection } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL, "confirmed");
const TIX_MINT = process.env.NEXT_PUBLIC_TIX_MINT;
const TREASURY_KEYPAIR = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_SECRET_KEY_BASE58)
);
const TREASURY_WALLET = TREASURY_KEYPAIR.publicKey;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  try {
    const { wallet, signature, tickets, expectedTotalBase = 0, lockedCredits = 0 } = req.body || {};
    if (!wallet) return res.status(400).json({ ok:false, error:"Missing wallet" });

    const v = validateTickets(tickets);
    if (v) return res.status(400).json({ ok:false, error: v });

    // Verify payment when expected
    if (Number(expectedTotalBase) > 0) {
      if (!signature) return res.status(400).json({ ok:false, error:"Missing signature" });

      const parsed = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
      if (!parsed) return res.status(400).json({ ok:false, error:"Transaction not found" });

      const pre = parsed.meta?.preTokenBalances || [];
      const post = parsed.meta?.postTokenBalances || [];
      const preBal = pre.find(b => b.mint === TIX_MINT && b.owner === TREASURY_WALLET.toBase58());
      const postBal = post.find(b => b.mint === TIX_MINT && b.owner === TREASURY_WALLET.toBase58());
      if (!postBal) return res.status(400).json({ ok:false, error:"Treasury TIX balance not present in tx" });

      const credited =
        BigInt(postBal.uiTokenAmount.amount) - BigInt(preBal ? preBal.uiTokenAmount.amount : "0");

      if (credited !== BigInt(expectedTotalBase)) {
        return res.status(400).json({ ok:false, error:`Amount mismatch. Expected ${expectedTotalBase}, got ${credited.toString()}` });
      }
    }

    // Consume credits (latest draw window)
    const { data: lastDraw, error: de } = await supabase
      .from("draws")
      .select("draw_date")
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (de) return res.status(500).json({ ok:false, error: de.message });
    const drawStart = lastDraw?.draw_date || null;

    let fetchCredits = supabase
      .from("pending_tickets")
      .select("id, ticket_type, created_at")
      .eq("wallet", wallet)
      .eq("is_redeemed", true)
      .eq("is_consumed", false)
      .order("created_at", { ascending: true });
    if (drawStart) fetchCredits = fetchCredits.gte("created_at", drawStart);

    const { data: creditsRows, error: ce } = await fetchCredits.limit(Number(lockedCredits));
    if (ce) return res.status(500).json({ ok:false, error: ce.message });
    if ((creditsRows?.length || 0) < Number(lockedCredits)) {
      return res.status(400).json({ ok:false, error:"Insufficient credits" });
    }

    if (Number(lockedCredits) > 0) {
      const ids = creditsRows.map(r => r.id);
      const { error: ue } = await supabase
        .from("pending_tickets")
        .update({ is_consumed: true })
        .in("id", ids);
      if (ue) return res.status(500).json({ ok:false, error: ue.message });
    }

    // Insert entries
    const creditTypes = (creditsRows || []).map(r => r.ticket_type || "promo");
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
}
