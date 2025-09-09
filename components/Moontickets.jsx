import React, { useEffect, useMemo, useState } from "react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

const range = (n, start=1) => Array.from({length:n}, (_,i)=>i+start);
const MAIN_POOL = range(25, 1);
const MOON_POOL = range(10, 1);
const TIX_PER_TICKET = 10_000; // static: $1 = 10k TIX

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

function isValidTweetUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    const allowed = ["x.com","www.x.com","twitter.com","www.twitter.com","mobile.twitter.com"];
    if (!allowed.includes(host)) return false;
    return /^\/[A-Za-z0-9_]{1,15}\/status\/\d+/.test(url.pathname);
  } catch { return false; }
}

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(data?.error || text || `HTTP ${res.status}`);
  return data ?? {};
}

export default function Moontickets({ publicKey, tixBalance, onRefresh }) {
  const [wallet, setWallet] = useState(publicKey?.toString?.() || "");
  useEffect(() => { if (publicKey?.toString) setWallet(publicKey.toString()); }, [publicKey]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = window.solana;
    if (!wallet && s?.isConnected && s.publicKey) setWallet(s.publicKey.toString());
    const onConnect = () => setWallet(s?.publicKey?.toString() || "");
    const onAcct = (pk) => setWallet(pk?.toString?.() || "");
    s?.on?.("connect", onConnect);
    s?.on?.("accountChanged", onAcct);
    return () => { s?.off?.("connect", onConnect); s?.off?.("accountChanged", onAcct); };
  }, [wallet]);

  // --- NEW: SOL balance ---
  const [solBalance, setSolBalance] = useState(0);
  const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || (typeof window !== "undefined" ? process.env.NEXT_PUBLIC_RPC_URL : "");
  useEffect(() => {
    let cancelled = false;
    async function loadSol() {
      if (!wallet) return setSolBalance(0);
      try {
        const conn = new Connection(process.env.NEXT_PUBLIC_RPC_URL, "confirmed");
        const lamports = await conn.getBalance(new PublicKey(wallet));
        if (!cancelled) setSolBalance(lamports / 1e9);
      } catch { if (!cancelled) setSolBalance(0); }
    }
    loadSol();
    const id = setInterval(loadSol, 20_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [wallet]);

  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState(0);
  const [tweetUrl, setTweetUrl] = useState("");
  const tweetOk = isValidTweetUrl(tweetUrl);

  // --- NEW: My tickets (current draw) ---
  const [myTickets, setMyTickets] = useState([]);
  const [myTixLoading, setMyTixLoading] = useState(false);

  async function fetchCredits() {
    if (!wallet) return;
    try {
      const j = await fetchJSON(`/api/ticketCredits?wallet=${wallet}`);
      setCredits(Number(j?.credits || 0));
    } catch (e) { console.error(e); }
  }
  useEffect(() => { fetchCredits(); }, [wallet]);

  // --- NEW: Load user's tickets for the current draw ---
  async function loadMyTickets() {
    if (!wallet) { setMyTickets([]); return; }
    setMyTixLoading(true);
    try {
      const j = await fetchJSON(`/api/myTickets?wallet=${wallet}`);
      setMyTickets(Array.isArray(j?.tickets) ? j.tickets : []);
    } catch (e) {
      console.error("loadMyTickets", e);
      setMyTickets([]);
    } finally {
      setMyTixLoading(false);
    }
  }
  useEffect(() => { if (wallet) loadMyTickets(); }, [wallet]);

  function addQuickPick() { setCart(prev => [...prev, quickPickOne()]); }
  function addBlankTicket() { setCart(prev => [...prev, { num1:1,num2:2,num3:3,num4:4,moonball:1 }]); }
  function updateTicket(idx, patch) { setCart(prev => prev.map((t,i)=> i===idx ? {...t, ...patch} : t)); }
  function removeTicket(idx) { setCart(prev => prev.filter((_,i)=> i!==idx)); }

  function isDisabledOption(ticketIdx, fieldKey, n) {
    const t = cart[ticketIdx] || {};
    const fields = ["num1","num2","num3","num4"].filter(f => f !== fieldKey);
    return fields.some(f => t[f] === n);
  }

  const ticketsToCredit = useMemo(() => Math.min(credits, cart.length), [credits, cart.length]);
  const ticketsToPay = useMemo(() => Math.max(0, cart.length - ticketsToCredit), [cart.length, ticketsToCredit]);
  const totalTixCost = useMemo(() => ticketsToPay * TIX_PER_TICKET, [ticketsToPay]);

  function openXComposer() {
    const defaultText = encodeURIComponent("Grabbing my free #Moonticket 🎟️ Come play: https://moonticket.io");
    window.open(`https://x.com/intent/post?text=${defaultText}`, "_blank", "noopener,noreferrer");
  }

  async function claimFree() {
    if (!wallet) return alert("Connect wallet first");
    if (!tweetOk) return alert("Paste a valid X/Twitter post URL like https://x.com/<handle>/status/<id>");
    setLoading(true);
    try {
      const json = await fetchJSON("/api/claimFreeTicket", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ wallet, tweetUrl })
      });
      if (!json?.ok) throw new Error(json?.error || "Claim failed");
      await fetchCredits();
      await loadMyTickets(); // NEW: refresh list in case claim auto-redeems later
      setTweetUrl("");
      alert("Free ticket credited! It will be applied at checkout.");
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function buyTickets() {
    const addr = wallet;
    if (!addr) return alert("Please connect wallet first");
    if (!cart.length) return alert("Add at least one ticket");
    for (const t of cart) {
      const err = validateTicket(t);
      if (err) return alert(err);
    }

    setLoading(true);
    try {
      // 1) Prepare: get tx & fee estimate
      const prep = await fetchJSON("/api/powerballEntryTx", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          wallet: addr,
          tickets: cart,
          tixCostPerTicket: TIX_PER_TICKET,
          useCredits: ticketsToCredit
        })
      });
      if (!prep?.ok) throw new Error(prep?.error || "Failed to prepare");

      // SOL pre-check (estimate may be 0 if credits cover all)
      const needLamports = Number(prep.estTotalLamports || 0);
      if (needLamports > 0) {
        // Refresh local balance once before prompt
        try {
          const conn = new Connection(process.env.NEXT_PUBLIC_RPC_URL, "confirmed");
          const lamports = await conn.getBalance(new PublicKey(addr));
          const have = lamports;
          if (have < needLamports) {
            const needSOL = (needLamports / 1e9).toFixed(6);
            const haveSOL = (have / 1e9).toFixed(6);
            throw new Error(`Not enough SOL for fees. Need ~${needSOL} SOL; you have ${haveSOL} SOL.`);
          }
        } catch (e) {
          throw e;
        }
      }

      let signature = null;
      if (prep.txBase64) {
        // sign and send (Phantom)
        const tx = Transaction.from(Buffer.from(prep.txBase64, "base64"));
        const { signature: sig } = await window.solana.signAndSendTransaction(tx);
        signature = sig;
      }

      // 2) Finalize
      const fin = await fetchJSON("/api/powerballEntryFinalize", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          wallet: addr,
          signature,
          tickets: cart,
          expectedTotalBase: prep.expectedTotalBase || 0,
          lockedCredits: prep.lockedCredits || 0
        })
      });
      if (!fin?.ok) throw new Error(fin?.error || "Finalize failed");

      setCart([]);
      await onRefresh?.();
      await fetchCredits();
      await loadMyTickets(); // NEW: refresh tickets after successful purchase
      alert(`Tickets submitted: ${fin.inserted} (credits: ${prep.lockedCredits || 0}, paid: ${ticketsToPay})`);
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  const selectStyle = {
    backgroundColor: "#fff",
    color: "#000",
    border: "1px solid #444",
    borderRadius: 6,
    padding: "4px 6px",
  };

  return (
    <div style={{maxWidth:900, margin:"0 auto", padding:"24px"}}>
      <h1 style={{marginBottom:8}}>Moontickets</h1>
      <div style={{opacity:0.8, marginBottom:16}}>
        Wallet: {wallet ? wallet.slice(0,4)+"…"+wallet.slice(-4) : "Not connected"}
      </div>

      {/* Weekly free credit */}
      <div style={{border:"1px solid #333", borderRadius:8, padding:12, marginBottom:16}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap"}}>
          <div style={{fontWeight:600}}>Weekly Free Ticket</div>
          <div style={{display:"flex", gap:8}}>
            <button onClick={openXComposer}>Post on X</button>
          </div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center", marginTop:8, flexWrap:"wrap"}}>
          <input
            style={{minWidth:320, background:"#111", color:"#fff", border:"1px solid #444", borderRadius:6, padding:"6px 8px"}}
            value={tweetUrl}
            onChange={e=>setTweetUrl(e.target.value)}
            placeholder="Paste tweet URL (required)"
          />
          <button onClick={claimFree} disabled={loading || !tweetOk}>Claim Free Ticket</button>
        </div>
        {!tweetOk && tweetUrl && (
          <div style={{marginTop:6, fontSize:12, color:"#fbbf24"}}>
            Enter a valid X/Twitter status URL (e.g., https://x.com/handle/status/12345).
          </div>
        )}
        <div style={{marginTop:6, fontSize:12, opacity:0.7}}>
          Claim adds a <b>credit</b>. Use it at checkout on your next ticket.
        </div>
      </div>

      {/* Build tickets */}
      <div style={{display:"flex", gap:8, marginBottom:12, flexWrap:"wrap"}}>
        <button onClick={addQuickPick}>+ Quick Pick</button>
        <button onClick={addBlankTicket}>+ Add Ticket</button>
      </div>

      {cart.map((t, idx) => (
        <div key={idx} style={{position:"relative", border:"1px solid #333", borderRadius:8, padding:12, marginBottom:8}}>
          <button
            aria-label="Remove"
            title="Remove ticket"
            onClick={()=>removeTicket(idx)}
            style={{ position:"absolute", top:6, right:8, background:"transparent", border:"none",
                     color:"#bbb", fontSize:18, cursor:"pointer", lineHeight:1 }}
          >×</button>

          <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
            {["num1","num2","num3","num4"].map(fieldKey => (
              <select
                key={fieldKey}
                style={selectStyle}
                value={t[fieldKey]}
                onChange={e=>updateTicket(idx, { [fieldKey]: Number(e.target.value) })}
              >
                {MAIN_POOL.map(n => (
                  <option key={n} value={n} disabled={isDisabledOption(idx, fieldKey, n)}>
                    {n}
                  </option>
                ))}
              </select>
            ))}
            <span>Moonball</span>
            <select
              style={selectStyle}
              value={t.moonball}
              onChange={e=>updateTicket(idx, {moonball: Number(e.target.value)})}
            >
              {MOON_POOL.map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <button onClick={()=>updateTicket(idx, quickPickOne())}>Quick Pick</button>
          </div>
          <div style={{marginTop:6, fontSize:12, opacity:0.7}}>
            4 unique 1–25 + Moonball 1–10.
          </div>
        </div>
      ))}

      {/* Totals */}
      <div style={{display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", marginTop:12}}>
        <div><b>Total tickets:</b> {cart.length}</div>
        <div><b>Credits available:</b> {credits}</div>
        <div><b>Applying credits:</b> {ticketsToCredit}</div>
        <div><b>Paying in TIX:</b> {ticketsToPay}</div>
        <div><b>Total cost (TIX):</b> {new Intl.NumberFormat().format(totalTixCost)}</div>
      </div>

      {/* NEW: Wallet / fees summary */}
      <div style={{display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", marginTop:6, opacity:0.9}}>
        <div><b>TIX balance:</b> {new Intl.NumberFormat().format(tixBalance ?? 0)}</div>
        <div><b>SOL balance:</b> {solBalance.toFixed(6)}</div>
        <div><b>TIX per ticket:</b> {new Intl.NumberFormat().format(TIX_PER_TICKET)}</div>
        <button onClick={() => { /* manual refresh */ }}>
          Refresh
        </button>
      </div>

      <div style={{marginTop:12}}>
        <button disabled={loading || !cart.length} onClick={buyTickets}>
          {loading ? "Processing..." : `Buy Tickets Now`}
        </button>
      </div>

      {/* NEW: My tickets for current drawing */}
      <div style={{marginTop:20}}>
        <h3 style={{marginBottom:8}}>My Tickets (current drawing)</h3>
        {myTixLoading ? (
          <div style={{opacity:0.8}}>Loading…</div>
        ) : myTickets.length === 0 ? (
          <div style={{opacity:0.8}}>No tickets yet for the current drawing.</div>
        ) : (
          <div style={{display:"grid", gap:8}}>
            {myTickets.map(t => (
              <div key={t.id} style={{border:"1px solid #333", borderRadius:8, padding:8, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:600}}>
                    {t.num1}-{t.num2}-{t.num3}-{t.num4} &nbsp; | &nbsp; Moonball {t.moonball}
                  </div>
                  <div style={{fontSize:12, opacity:0.7}}>
                    {new Date(t.created_at).toLocaleString()} · {t.entry_type || "credit"}
                  </div>
                </div>
                <div style={{fontSize:12, opacity:0.7}}>#{t.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
