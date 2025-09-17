import React, { useEffect, useMemo, useState } from "react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

const range = (n, start=1) => Array.from({length:n}, (_,i)=>i+start);
const MAIN_POOL = range(25, 1);
const MOON_POOL = range(10, 1);
const TIX_PER_TICKET = 10_000; // informational

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

  // SOL balance
  const [solBalance, setSolBalance] = useState(0);
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

  // Current-draw tickets
  const [myTickets, setMyTickets] = useState([]);
  async function loadMyTickets() {
    if (!wallet) { setMyTickets([]); return; }
    try {
      const j = await fetchJSON(`/api/myTickets?wallet=${wallet}`);
      setMyTickets(j?.items || []);
    } catch (e) {
      console.error("myTickets error:", e);
      setMyTickets([]);
    }
  }

  async function fetchCredits() {
    if (!wallet) return;
    try {
      const j = await fetchJSON(`/api/ticketCredits?wallet=${wallet}`);
      setCredits(Number(j?.credits || 0));
    } catch (e) { console.error(e); }
  }
  useEffect(() => { fetchCredits(); loadMyTickets(); }, [wallet]);

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

  function openXComposer() {
    const defaultText = encodeURIComponent("I got my free weekly Moonticket for this week's jackpot drawing. Get yours at: https://moonticket.io @moonticket__io");
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

      const fin = await fetchJSON("/api/powerballEntryFinalize", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          wallet: addr,
          signature: null,
          tickets: cart,
          expectedTotalBase: 0,
          lockedCredits: prep.lockedCredits || 0
        })
      });
      if (!fin?.ok) throw new Error(fin?.error || "Finalize failed");

      setCart([]);
      await onRefresh?.();
      await fetchCredits();
      await loadMyTickets();
      alert(`Tickets submitted: ${fin.inserted} (credits used: ${prep.lockedCredits || 0})`);
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

  const btn = {
    background: "#fbbf24",
    color: "#000",
    border: "none",
    borderRadius: 8,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
  };

  const btnOutline = {
    background: "transparent",
    color: "#fbbf24",
    border: "1px solid #fbbf24",
    borderRadius: 8,
    padding: "6px 10px",
    fontWeight: 600,
    cursor: "pointer",
  };

  // Helper: render number images for a ticket
  function TicketImages({ t }) {
    const nums = [t.num1, t.num2, t.num3, t.num4].sort((a,b)=>a-b);
    const wrapper = { display:"inline-flex", gap:6, alignItems:"center", verticalAlign:"middle" };
    const imgStyle = { width:128, height:128, objectFit:"contain" };
    return (
      <span style={wrapper}>
        {nums.map((n,i)=>(
          <img key={i} src={`/numbers/yellow/${n}.png`} alt={`${n}`} style={imgStyle} />
        ))}
        <img src={`/numbers/green/${t.moonball}.png`} alt={`MB ${t.moonball}`} style={{...imgStyle, marginLeft:4}} />
      </span>
    );
  }

  // ---------------------------
  // Last drawing tickets (replaces Past tickets)
  // ---------------------------
  const PAGE_SIZE = 10;
  const [pastOpen, setPastOpen]       = useState(false);
  const [pastPage, setPastPage]       = useState(1);
  const [pastTotal, setPastTotal]     = useState(0);
  const [pastItems, setPastItems]     = useState([]);
  const [loadingPast, setLoadingPast] = useState(false);

  async function loadPastTickets(page = pastPage) {
    if (!wallet) { setPastItems([]); setPastTotal(0); return; }
    setLoadingPast(true);
    try {
      // last drawing window
      const j = await fetchJSON(`/api/mypastTickets?wallet=${wallet}&window=last&page=${page}&limit=${PAGE_SIZE}`);
      setPastItems(Array.isArray(j?.items) ? j.items : []);
      setPastTotal(Number(j?.total || (j?.items?.length || 0)));
    } catch (e) {
      console.error("pastTickets error:", e);
      setPastItems([]);
      setPastTotal(0);
    } finally {
      setLoadingPast(false);
    }
  }

  useEffect(() => { if (pastOpen) loadPastTickets(1); }, [wallet, pastOpen]);
  useEffect(() => { if (pastOpen) loadPastTickets(pastPage); }, [pastPage]); // page change

  const totalPages = Math.max(1, Math.ceil(pastTotal / PAGE_SIZE));

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "24px",
        // increased to clear the nav thoroughly
        paddingTop: "40px",
      }}
    >

      {/* Weekly free credit */}
      <div style={{border:"1px solid #333", borderRadius:8, padding:12, marginBottom:16}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap"}}>
          <div style={{fontWeight:600}}>Weekly Free Ticket</div>
          <div style={{display:"flex", gap:8}}>
            <button style={btnOutline} onClick={openXComposer}>Post on X</button>
          </div>
        </div>

        {/* NEW: explanatory text */}
        <p style={{marginTop:8, fontSize:14, lineHeight:1.4, color:"#e5b400"}}>
          Claim your <b>free weekly Moonticket</b> in four quick steps:
          <span> 1) click <i>Post on X</i> to open a pre-filled post,</span>
          <span> 2) publish it,</span>
          <span> 3) copy the link to your post,</span>
          <span> 4) paste it below and press <i>Claim Free Ticket</i>.</span>
          You’re eligible for <b>one free ticket per drawing</b>.
        </p>

        <div style={{display:"flex", gap:8, alignItems:"center", marginTop:8, flexWrap:"wrap"}}>
          <input
            style={{minWidth:320, background:"#111", color:"#fff", border:"1px solid #444", borderRadius:6, padding:"6px 8px"}}
            value={tweetUrl}
            onChange={e=>setTweetUrl(e.target.value)}
            placeholder="Paste tweet URL (required)"
          />
          <button style={btn} onClick={claimFree} disabled={loading || !tweetOk}>
            Claim Free Ticket
          </button>
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
        <button style={btnOutline} onClick={addQuickPick}>+ Quick Pick</button>
        <button style={btnOutline} onClick={addBlankTicket}>+ Add Ticket</button>
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

            {/* Moonball label + select kept together on one line (mobile too) */}
            <span style={{display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap"}}>
              <span>Moonball</span>
              <select
                style={selectStyle}
                value={t.moonball}
                onChange={e=>updateTicket(idx, {moonball: Number(e.target.value)})}
              >
                {MOON_POOL.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </span>

            <button style={btnOutline} onClick={()=>updateTicket(idx, quickPickOne())}>Quick Pick</button>
          </div>
          <div style={{marginTop:6, fontSize:12, opacity:0.7}}>
            4 unique 1–25 + Moonball 1–10.
          </div>
        </div>
      ))}

      {/* Totals (trimmed & compact) */}
      <div style={{display:"flex", flexWrap:"wrap", gap:16, alignItems:"center", marginTop:12}}>
        <div><b>Total tickets:</b> {cart.length}</div>
        <div><b>Credits available:</b> {credits}</div>
        <div><b>Applying credits:</b> {ticketsToCredit}</div>
      </div>

      {/* Wallet / misc (trimmed to only refresh) */}
      <div style={{display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", marginTop:6, opacity:0.9}}>
        <button
          style={btnOutline}
          onClick={async () => { await fetchCredits(); await loadMyTickets(); }}
        >
          Refresh
        </button>
      </div>

      <div style={{marginTop:12}}>
        <button style={{...btn, padding:"10px 16px"}} disabled={loading || !cart.length} onClick={buyTickets}>
          {loading ? "Processing..." : `Buy Tickets Now`}
        </button>
      </div>

      {/* My tickets (current drawing) */}
      <div style={{marginTop:24}}>
        <div style={{fontWeight:700, marginBottom:8}}>My Tickets (current drawing)</div>
        {!myTickets.length ? (
          <div style={{opacity:0.8}}>No tickets yet for the current drawing.</div>
        ) : (
          <ul style={{listStyle:"none", padding:0, margin:0}}>
            {myTickets.map((t) => (
              <li key={t.id} style={{marginBottom:6, display:"flex", alignItems:"center", gap:8}}>
                <TicketImages t={t} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Last Drawing Tickets (collapsible) */}
      <div style={{marginTop:24, borderTop:"1px solid #333", paddingTop:16}}>
        <button
          onClick={() => setPastOpen(o => !o)}
          style={{
            ...btnOutline,
            padding:"8px 12px",
            display:"inline-flex",
            alignItems:"center",
            gap:8
          }}
        >
          {pastOpen ? "▼" : "►"} Last Drawing Tickets
        </button>

        {pastOpen && (
          <div style={{marginTop:12}}>
            {loadingPast ? (
              <div style={{opacity:0.8}}>Loading…</div>
            ) : !pastItems.length ? (
              <div style={{opacity:0.8}}>No tickets from the last drawing window.</div>
            ) : (
              <>
                <ul style={{listStyle:"none", padding:0, margin:0}}>
                  {pastItems.map((t) => (
                    <li key={t.id} style={{marginBottom:6, display:"flex", alignItems:"center", gap:8}}>
                      <TicketImages t={t} />
                      {t.draw_date && (
                        <span style={{opacity:0.6}}>
                           · Draw: {new Date(t.draw_date).toLocaleString()}
                        </span>
                      )}
                      {typeof t.prize_tix === "number" || typeof t.prize_sol === "number" ? (
                        <span style={{marginLeft:6, color:"#9FE870"}}>
                          {t.prize_sol > 0
                            ? ` • WIN: ${(t.prize_sol).toFixed(6)} SOL`
                            : t.prize_tix > 0
                              ? ` • WIN: ${Number(t.prize_tix).toLocaleString()} TIX`
                              : ` • No prize`}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>

                {/* Pagination */}
                <div style={{display:"flex", gap:8, alignItems:"center", marginTop:12}}>
                  <button
                    style={btnOutline}
                    onClick={() => setPastPage(p => Math.max(1, p - 1))}
                    disabled={pastPage <= 1}
                  >
                    Prev
                  </button>
                  <span style={{opacity:0.9}}>Page {pastPage} / {totalPages}</span>
                  <button
                    style={btnOutline}
                    onClick={() => setPastPage(p => Math.min(totalPages, p + 1))}
                    disabled={pastPage >= totalPages}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
