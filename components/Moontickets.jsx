import React, { useEffect, useMemo, useState } from "react";

const range = (n, start=1) => Array.from({length:n}, (_,i)=>i+start);
const MAIN_POOL = range(25, 1);
const MOON_POOL = range(10, 1);

function quickPickOne() {
  const pool = [...MAIN_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const nums = pool.slice(0,4).sort((a,b)=>a-b);
  const moon = 1 + Math.floor(Math.random()*10);
  return { num1: nums[0], num2: nums[1], num3: nums[2], num4: nums[3], moonball: moon };
}

function validateTicket(t) {
  const nums = [t.num1, t.num2, t.num3, t.num4];
  const uniq = new Set(nums);
  if (nums.some(v => v < 1 || v > 25)) return "Main numbers must be 1–25";
  if (uniq.size !== 4) return "Main numbers must be unique";
  if (t.moonball < 1 || t.moonball > 10) return "Moonball must be 1–10";
  return null;
}

export default function Moontickets({ publicKey, tixPriceUSD, tixBalance, onRefresh }) {
  const wallet = publicKey?.toString?.() || "";
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState(0);            // free/promo credits available for this draw
  const [tweetUrl, setTweetUrl] = useState("");         // optional input for free claim

  const tixPerTicket = useMemo(() => {
    if (!tixPriceUSD || tixPriceUSD <= 0) return 0;
    return 1 / tixPriceUSD; // 1 USD worth of TIX per ticket
  }, [tixPriceUSD]);

  async function fetchCredits() {
    if (!wallet) return;
    try {
      const res = await fetch(`/api/ticketCredits?wallet=${wallet}`);
      const json = await res.json();
      setCredits(Number(json?.credits || 0));
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => { fetchCredits(); }, [wallet]);

  function addQuickPick() {
    setCart(prev => [...prev, quickPickOne()]);
  }
  function addBlankTicket() {
    setCart(prev => [...prev, { num1:1,num2:2,num3:3,num4:4,moonball:1 }]);
  }
  function updateTicket(idx, patch) {
    setCart(prev => prev.map((t,i)=> i===idx ? {...t, ...patch} : t));
  }
  function removeTicket(idx) {
    setCart(prev => prev.filter((_,i)=> i!==idx));
  }

  const ticketsToCredit = useMemo(() => Math.min(credits, cart.length), [credits, cart.length]);
  const ticketsToPay = useMemo(() => Math.max(0, cart.length - ticketsToCredit), [cart.length, ticketsToCredit]);
  const totalTixCost = useMemo(() => ticketsToPay * tixPerTicket, [ticketsToPay, tixPerTicket]);

  async function claimFree() {
    if (!wallet) return alert("Connect wallet first");
    setLoading(true);
    try {
      const res = await fetch("/api/claimFreeTicket", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ wallet, tweetUrl: tweetUrl || null })
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Claim failed");
      await fetchCredits();
      setTweetUrl("");
      alert("Free ticket claimed!");
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function buyTickets() {
    if (!wallet) return alert("Connect wallet first");
    if (cart.length === 0) return alert("Add at least one ticket");

    for (const t of cart) {
      const err = validateTicket(t);
      if (err) return alert(err);
    }

    setLoading(true);
    try {
      // 1) Ask backend to compute credits vs payable & build unsigned transfer (if needed)
      const txPrep = await fetch("/api/powerballEntryTx", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          wallet,
          tickets: cart,
          tixCostPerTicket: tixPerTicket,
          useCredits: ticketsToCredit
        })
      }).then(r=>r.json());

      if (!txPrep?.ok) throw new Error(txPrep?.error || "Failed to prepare transaction");

      let signature = null;
      if (txPrep.txBase64) {
        // 2) Sign and send with Phantom
        const txnBytes = Uint8Array.from(atob(txPrep.txBase64), c=>c.charCodeAt(0));
        const signed = await window.solana.signAndSendTransaction({ serializedTransaction: txnBytes });
        signature = signed?.signature || signed; // different Phantom versions
      }

      // 3) Finalize: verify on-chain (if needed), insert entries, consume credits
      const fin = await fetch("/api/powerballEntryFinalize", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          wallet,
          signature,
          tickets: cart,
          expectedTotalBase: txPrep.expectedTotalBase || 0,
          lockedCredits: txPrep.lockedCredits || 0
        })
      }).then(r=>r.json());

      if (!fin?.ok) throw new Error(fin?.error || "Finalize failed");

      setCart([]);
      await onRefresh?.();
      await fetchCredits();
      alert(`Tickets submitted: ${fin.inserted} (${ticketsToCredit} credit, ${ticketsToPay} paid)`);
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{maxWidth:900, margin:"0 auto", padding:"24px"}}>
      <h1 style={{marginBottom:8}}>Moontickets</h1>
      <div style={{opacity:0.8, marginBottom:16}}>
        Wallet: {wallet ? wallet.slice(0,4)+"…"+wallet.slice(-4) : "Not connected"}
      </div>

      <div style={{display:"flex", gap:16, flexWrap:"wrap", alignItems:"center", marginBottom:16}}>
        <div><b>TIX balance:</b> {tixBalance?.toLocaleString?.() ?? "—"}</div>
        <div><b>TIX price:</b> {tixPriceUSD ? `$${tixPriceUSD.toFixed(6)}` : "—"}</div>
        <div><b>TIX per ticket:</b> {tixPerTicket ? tixPerTicket.toFixed(3) : "—"}</div>
        <div><b>Credits this draw:</b> {credits}</div>
      </div>

      {/* Free ticket claim */}
      <div style={{border:"1px solid #333", borderRadius:8, padding:12, marginBottom:16}}>
        <div style={{marginBottom:8, fontWeight:600}}>Weekly Free Ticket</div>
        <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
          <input
            style={{minWidth:260}}
            value={tweetUrl}
            onChange={e=>setTweetUrl(e.target.value)}
            placeholder="Paste tweet URL (optional)"
          />
          <button onClick={claimFree} disabled={loading}>Claim Free Ticket</button>
        </div>
        <div style={{marginTop:6, fontSize:12, opacity:0.7}}>
          Claim adds a credit. Use it at checkout on your next ticket.
        </div>
      </div>

      {/* Build tickets */}
      <div style={{display:"flex", gap:8, marginBottom:12}}>
        <button onClick={addQuickPick}>+ Quick Pick</button>
        <button onClick={addBlankTicket}>+ Add Ticket</button>
      </div>

      {cart.map((t, idx) => (
        <div key={idx} style={{border:"1px solid #333", borderRadius:8, padding:12, marginBottom:8}}>
          <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
            {[1,2,3,4].map(k => (
              <select
                key={k}
                value={t[`num${k}`]}
                onChange={e=>updateTicket(idx, {[`num${k}`]: Number(e.target.value)})}
              >
                {MAIN_POOL.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            ))}
            <span>Moonball</span>
            <select
              value={t.moonball}
              onChange={e=>updateTicket(idx, {moonball: Number(e.target.value)})}
            >
              {MOON_POOL.map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <button onClick={()=>updateTicket(idx, quickPickOne())}>Quick Pick</button>
            <button onClick={()=>removeTicket(idx)}>Remove</button>
          </div>
          <div style={{marginTop:6, fontSize:12, opacity:0.7}}>
            4 unique 1–25 + Moonball 1–10.
          </div>
        </div>
      ))}

      {/* Totals */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12, gap:12, flexWrap:"wrap"}}>
        <div><b>Total tickets:</b> {cart.length}</div>
        <div><b>Applying credits:</b> {ticketsToCredit}</div>
        <div><b>Paying in TIX:</b> {ticketsToPay}</div>
        <div><b>Total cost (TIX):</b> {totalTixCost ? totalTixCost.toFixed(3) : "0"}</div>
      </div>

      <div style={{marginTop:12}}>
        <button disabled={loading || !cart.length} onClick={buyTickets}>
          {loading ? "Processing..." : `Buy Tickets Now`}
        </button>
      </div>
    </div>
  );
}
