import React, { useEffect, useMemo, useState } from "react";
import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import useJackpotData from "../hooks/useJackpotData";
import useCountdown from "../hooks/useCountdown";
import CheckInButton from "./CheckInButton"; // ⬅️ added
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

const TIX_MINT = new PublicKey(process.env.NEXT_PUBLIC_TIX_MINT);
const range = (n, start = 1) => Array.from({ length: n }, (_, i) => i + start);
const MAIN_POOL = range(25, 1);
const MOON_POOL = range(10, 1);
const TIX_PER_TICKET = 10_000; // informational

// --- Buy flow constants (same as your BuyTix.jsx) ---
const TREASURY_WALLET = new PublicKey("FrAvtjXo5JCsWrjcphvWCGQDrXX8PuEbN2qu2SGdvurG");
const OPS_WALLET = new PublicKey("nJmonUssRvbp85Nvdd9Bnxgh86Hf6BtKfu49RdcoYE9");

function quickPickOne() {
  const pool = [...MAIN_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const nums = pool.slice(0, 4).sort((a, b) => a - b);
  const moon = 1 + Math.floor(Math.random() * 10);
  return { num1: nums[0], num2: nums[1], num3: nums[2], num4: nums[3], moonball: moon };
}

function validateTicket(t) {
  const nums = [t.num1, t.num2, t.num3, t.num4];
  const uniq = new Set(nums);
  if (nums.some((v) => v < 1 || v > 25)) return "Main numbers must be 1–25";
  if (uniq.size !== 4) return "Main numbers must be unique";
  if (t.moonball < 1 || t.moonball > 10) return "Moonball must be 1–10";
  return null;
}

function isValidTweetUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    const allowed = ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"];
    if (!allowed.includes(host)) return false;
    return /^\/[A-Za-z0-9_]{1,15}\/status\/\d+/.test(url.pathname);
  } catch {
    return false;
  }
}

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) throw new Error(data?.error || text || `HTTP ${res.status}`);
  return data ?? {};
}

/** Robustly parse strings like "Monday, September 22, 2025 at 10:00 PM CDT" */
function parseDrawDate(str) {
  if (!str) return NaN;
  // Try native first
  const native = Date.parse(str);
  if (!Number.isNaN(native)) return native;

  // Fallback: extract Month Day, Year and time + TZ abbr
  const r =
    /([A-Za-z]+),?\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*([A-Z]{2,4})?/.exec(
      str
    );
  if (!r) return NaN;

  const [, , monthName, dayStr, yearStr, hhStr, mmStr, ampm, tzAbbr = "UTC"] = r;
  const months =
    "January February March April May June July August September October November December"
      .split(" ")
      .reduce((m, v, i) => ((m[v.toLowerCase()] = i), m), {});
  const month = months[monthName.toLowerCase()];
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  let hh = parseInt(hhStr, 10) % 12;
  if (ampm.toUpperCase() === "PM") hh += 12;
  const mm = parseInt(mmStr, 10);

  const tzOffsets = {
    UTC: 0,
    GMT: 0,
    EDT: -4,
    EST: -5,
    CDT: -5,
    CST: -6,
    MDT: -6,
    MST: -7,
    PDT: -7,
    PST: -8,
  };
  const offsetHours = tzOffsets[tzAbbr] ?? 0;
  // Create UTC time from local "timezone" and subtract the offset to get actual UTC epoch
  const utcMs = Date.UTC(year, month, day, hh - offsetHours, mm, 0, 0);
  return utcMs;
}

export default function Moontickets({ publicKey, tixBalance, onRefresh }) {
  // ---------------- Wallet glue ----------------
  const [wallet, setWallet] = useState(publicKey?.toString?.() || "");
  useEffect(() => {
    if (publicKey?.toString) setWallet(publicKey.toString());
  }, [publicKey]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = window.solana;
    if (!wallet && s?.isConnected && s.publicKey) setWallet(s.publicKey.toString());
    const onConnect = () => setWallet(s?.publicKey?.toString() || "");
    const onAcct = (pk) => setWallet(pk?.toString?.() || "");
    s?.on?.("connect", onConnect);
    s?.on?.("accountChanged", onAcct);
    return () => {
      s?.off?.("connect", onConnect);
      s?.off?.("accountChanged", onAcct);
    };
  }, [wallet]);

  // ALSO expose wallet adapter hooks for send & sign flow
  const { publicKey: waPubkey, sendTransaction, connect: waConnect } = useWallet();

  // ---------------- Jackpot header ----------------
  const jackpot = useJackpotData(); // { jackpotSol }
  const { nextMoonDrawDate } = useCountdown(); // using only the date

  const [solPrice, setSolPrice] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/prices");
        const data = await res.json();
        setSolPrice(data.solPriceUsd || 0);
      } catch {}
    })();
  }, []);
  const jackpotSol = jackpot?.jackpotSol || 0;
  const jackpotUsd = solPrice > 0 ? jackpotSol * solPrice : 0;

  // Flip-clock remaining time
  const [remain, setRemain] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const target =
      parseDrawDate(nextMoonDrawDate || "") || Date.parse(nextMoonDrawDate || "");
    if (!target || Number.isNaN(target)) return;
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setRemain({ d, h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextMoonDrawDate]);

  function FlipTile({ value, label }) {
    const pad2 = (v) => String(v ?? 0).padStart(2, "0");
    const [display, setDisplay] = useState(pad2(value));
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
      const next = pad2(value);
      if (next !== display) {
        setDisplay(next);
        setAnimate(true);
        const t = setTimeout(() => setAnimate(false), 650); // stop animation after flip
        return () => clearTimeout(t);
      }
    }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div className="flip-wrap">
        <div className="flip-tile">
          <span className={`flip-number ${animate ? "flip-animate" : ""}`}>
            {display}
          </span>
        </div>
        <div className="flip-label">{label}</div>
      </div>
    );
  }

  // ---------------- Balances ----------------
  const [solBalance, setSolBalance] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function loadSol() {
      if (!wallet) return setSolBalance(0);
      try {
        const conn = new Connection(process.env.NEXT_PUBLIC_RPC_URL, "confirmed");
        const lamports = await conn.getBalance(new PublicKey(wallet));
        if (!cancelled) setSolBalance(lamports / 1e9);
      } catch {
        if (!cancelled) setSolBalance(0);
      }
    }
    loadSol();
    const id = setInterval(loadSol, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [wallet]);

  // ---------------- Daily Check-In (added) ----------------
  const [streak, setStreak] = useState(0);
  const [lastCheckin, setLastCheckin] = useState(null);

  useEffect(() => {
    // same API used by Jackpot component
    const fetchCheckinStatus = async () => {
      if (!wallet) return;
      try {
        const res = await fetch(`/api/checkinStatus?wallet=${wallet}`);
        const data = await res.json();
        setStreak(data.streak || 0);
        setLastCheckin(data.lastCheckin ? new Date(data.lastCheckin) : null);
      } catch (err) {
        console.error("Failed to fetch check-in status:", err);
      }
    };
    fetchCheckinStatus();
  }, [wallet]);

  // ---------------- Ticket builder ----------------
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState(0);
  const [tweetUrl, setTweetUrl] = useState("");
  const tweetOk = isValidTweetUrl(tweetUrl);

  // Current-draw tickets
  const [myTickets, setMyTickets] = useState([]);
  async function loadMyTickets() {
    if (!wallet) {
      setMyTickets([]);
      return;
    }
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
    } catch (e) {
      console.error(e);
    }
  }
  useEffect(() => {
    fetchCredits();
    loadMyTickets();
  }, [wallet]);

  function addQuickPick() {
    setCart((prev) => [...prev, quickPickOne()]);
  }
  function addBlankTicket() {
    setCart((prev) => [...prev, { num1: 1, num2: 2, num3: 3, num4: 4, moonball: 1 }]);
  }
  function updateTicket(idx, patch) {
    setCart((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function removeTicket(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function isDisabledOption(ticketIdx, fieldKey, n) {
    const t = cart[ticketIdx] || {};
    const fields = ["num1", "num2", "num3", "num4"].filter((f) => f !== fieldKey);
    return fields.some((f) => t[f] === n);
  }

  const ticketsToCredit = useMemo(() => Math.min(credits, cart.length), [credits, cart.length]);

  // ---------------- Free ticket flow ----------------
  const postText = encodeURIComponent(
    "I got my free weekly Moonticket for this week's jackpot drawing. Get yours at: https://moonticket.io @moonticket__io"
  );
  const INTENT_X = `https://x.com/intent/post?text=${postText}`;

  async function claimFree() {
    if (!wallet) return alert("Connect wallet first");
    if (!tweetOk) return alert("Paste a valid X/Twitter post URL like https://x.com/<handle>/status/<id>");
    setLoading(true);
    try {
      const json = await fetchJSON("/api/claimFreeTicket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, tweetUrl }),
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

  // ---------------- Buy TIX (from BuyTix.jsx) ----------------
  const [solInput, setSolInput] = useState("");
  const [loadingBuy, setLoadingBuy] = useState(false);
  const [resultBuy, setResultBuy] = useState(null);
  const [solPriceUsd, setSolPriceUsd] = useState(null);
  const [tixPriceUsd, setTixPriceUsd] = useState(null);

  useEffect(() => {
    const fetchPrices = async () => {
      const res = await fetch("/api/prices");
      const data = await res.json();
      setSolPriceUsd(data.solPriceUsd);
      setTixPriceUsd(data.tixPriceUsd);
    };
    fetchPrices();
  }, []);

  const solTyped = Number(solInput || 0);
  const usdPreview = solPriceUsd != null && !Number.isNaN(solTyped) ? solTyped * solPriceUsd : 0;
  const creditsPreview = Math.floor(usdPreview + 1e-6); // 1 credit per $1
  const tixPreview = tixPriceUsd != null && tixPriceUsd > 0 ? Math.floor(usdPreview / tixPriceUsd) : 0;

  const creditsEarned =
    resultBuy && resultBuy.success && typeof resultBuy.usdSpent === "number"
      ? Math.floor(resultBuy.usdSpent + 1e-6)
      : null;

  const handleBuy = async () => {
  if (isNaN(parseFloat(solInput))) return;
  setLoadingBuy(true);
  setResultBuy(null);

  try {
    if (!window?.solana) throw new Error("Phantom not found");
    // ensure connection (silent first, then interactive)
    try {
      await window.solana.connect({ onlyIfTrusted: true }).catch(() => window.solana.connect());
    } catch {
      setLoadingBuy(false);
      return; // user cancelled
    }

    const phantomPubkey = window.solana.publicKey;
    if (!phantomPubkey) throw new Error("Wallet not connected");
    const pkStr = phantomPubkey.toString();
    if (pkStr !== wallet) setWallet(pkStr);

    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL, "confirmed");

    // --- amounts for your split ---
    const totalLamports = Math.round(parseFloat(solInput) * 1e9);
    const opsLamports = Math.floor(totalLamports * 0.01);
    const treasuryLamports = totalLamports - opsLamports;

    // --- check if buyer has TIX ATA; if not, we will create it in the SAME tx ---
    const buyerAta = await getAssociatedTokenAddress(TIX_MINT, phantomPubkey);
    const ataInfo = await connection.getAccountInfo(buyerAta, "confirmed");
    const needsAta = !ataInfo;

    // Rent needed to create an SPL token account (165 bytes)
    const ataRentLamports = needsAta
      ? await connection.getMinimumBalanceForRentExemption(165, "confirmed")
      : 0;

    // Build the exact transaction we'll send (so fee estimate is accurate)
    const tx = new Transaction();

    if (needsAta) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          phantomPubkey,   // payer (user)
          buyerAta,        // ATA to create
          phantomPubkey,   // owner
          TIX_MINT
        )
      );
    }

    // Your SOL transfers
    tx.add(
      SystemProgram.transfer({
        fromPubkey: phantomPubkey,
        toPubkey: TREASURY_WALLET,
        lamports: treasuryLamports,
      }),
      SystemProgram.transfer({
        fromPubkey: phantomPubkey,
        toPubkey: OPS_WALLET,
        lamports: opsLamports,
      })
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = phantomPubkey;

    // ---- Preflight balance check: fee + transfers + ATA rent (if needed) ----
    const [estimatedFeeLamports, balanceLamports] = await Promise.all([
      connection.getFeeForMessage(tx.compileMessage(), "confirmed").then(r => r.value ?? 5000),
      connection.getBalance(phantomPubkey, "confirmed"),
    ]);

    const SAFETY = 2000; // tiny cushion
    const requiredLamports =
      treasuryLamports + opsLamports + ataRentLamports + estimatedFeeLamports + SAFETY;

    if (balanceLamports < requiredLamports) {
      const maxSpendLamports =
        Math.max(0, balanceLamports - (ataRentLamports + estimatedFeeLamports + SAFETY));
      const maxSpendSOL = Math.floor((maxSpendLamports / 1e9) * 1e6) / 1e6; // 6dp
      setLoadingBuy(false);
      alert(
        `Insufficient SOL to cover purchase, fees${needsAta ? " and ATA rent" : ""}.\n\n` +
        `Your balance: ${(balanceLamports/1e9).toFixed(6)} SOL\n` +
        `Estimated fee: ${(estimatedFeeLamports/1e9).toFixed(6)} SOL` +
        (needsAta ? `\nATA rent: ${(ataRentLamports/1e9).toFixed(6)} SOL` : "") +
        `\n\nMax spend right now: ~${maxSpendSOL} SOL`
      );
      return;
    }

    // ✅ Send through Phantom (single prompt)
    const sigRes = await window.solana.signAndSendTransaction(tx);
    const sig = typeof sigRes === "string" ? sigRes : sigRes.signature;

    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

    // backend sends TIX
    const res2 = await fetch("/api/buyTix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress: pkStr,
        solAmount: parseFloat(solInput),
      }),
    });
    const data = await res2.json();
    if (!data.success) throw new Error(data.error || "TIX transfer failed");

    setResultBuy(data);

    // refresh balance + credits
    try {
      const lam = await connection.getBalance(phantomPubkey, "confirmed");
      setSolBalance(lam / 1e9);
    } catch {}
    await fetchCredits();
  } catch (err) {
    console.error("Buy TIX failed:", err);
    setResultBuy({ success: false, error: err?.message || "Failed to buy TIX" });
  }

  setLoadingBuy(false);
};

  // ---------------- Helper: number images ----------------
  function TicketImages({ t }) {
    const nums = [t.num1, t.num2, t.num3, t.num4].sort((a, b) => a - b);
    const wrapper = { display: "inline-flex", gap: 2, alignItems: "center", verticalAlign: "middle" };
    const imgStyle = { width: 80, height: 80, objectFit: "contain" };
    return (
      <span style={wrapper}>
        {nums.map((n, i) => (
          <img key={i} src={`/numbers/yellow/${n}.png`} alt={`${n}`} style={imgStyle} />
        ))}
        <img src={`/numbers/green/${t.moonball}.png`} alt={`MB ${t.moonball}`} style={{ ...imgStyle, marginLeft: 4 }} />
      </span>
    );
  }

  // ---------------- Last drawing tickets ----------------
  const PAGE_SIZE = 10;
  const [pastOpen, setPastOpen] = useState(false);
  const [pastPage, setPastPage] = useState(1);
  const [pastTotal, setPastTotal] = useState(0);
  const [pastItems, setPastItems] = useState([]);
  const [loadingPast, setLoadingPast] = useState(false);

  async function loadPastTickets(page = pastPage) {
    if (!wallet) {
      setPastItems([]);
      setPastTotal(0);
      return;
    }
    setLoadingPast(true);
    try {
      const j = await fetchJSON(
        `/api/myPastTickets?wallet=${wallet}&window=last&page=${page}&limit=${PAGE_SIZE}`
      );
      setPastItems(Array.isArray(j?.items) ? j.items : []);
      setPastTotal(Number(j?.total || j?.items?.length || 0));
    } catch (e) {
      console.error("pastTickets error:", e);
      setPastItems([]);
      setPastTotal(0);
    } finally {
      setLoadingPast(false);
    }
  }

  useEffect(() => {
    if (pastOpen) loadPastTickets(1);
  }, [wallet, pastOpen]);
  useEffect(() => {
    if (pastOpen) loadPastTickets(pastPage);
  }, [pastPage]);

  const totalPages = Math.max(1, Math.ceil(pastTotal / PAGE_SIZE));

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "24px",
        paddingTop: "40px",
      }}
    >
      {/* Local styles for jackpot + flip clock */}
      <style>{`
        .jackpot-card {
          border: 1px solid #333; border-radius: 12px; padding: 16px; margin-bottom: 16px;
          background: rgba(255,255,255,0.02);
        }
        .jackpot-grid {
          display: grid; gap: 16px; align-items: center;
          grid-template-columns: 1fr;
        }
        @media (min-width: 720px) {
          .jackpot-grid { grid-template-columns: 1.2fr 1fr; }
        }
        .jackpot-title { font-size: 28px; font-weight: 800; margin: 0 0 8px; }
        .jackpot-amount { font-size: 24px; font-weight: 700; }
        .jackpot-amount small { opacity: .85; font-weight: 600; }
        .flip-row { display: flex; gap: 14px; justify-content: center; flex-wrap: nowrap; }
        .flip-wrap { text-align: center; }
        .flip-tile {
          position: relative; width: 96px; height: 96px;
          background: #000; border: 2px solid #fbbf24; border-radius: 8px;
          box-shadow: inset 0 -2px 0 rgba(251,191,36,.3);
          display: grid; place-items: center; overflow: hidden;
        }
        .flip-number {
        font-size: 54px;
        font-weight: 800;
        color: #fbbf24;
        line-height: 1;
        display: block;
        transform-origin: center top;
        }
        .flip-animate {
          animation: flip 0.6s ease-in-out;
        }
        @keyframes flip {
          0%   { transform: rotateX(0deg); }
          45%  { transform: rotateX(90deg); opacity: 0.75; }
          55%  { transform: rotateX(90deg); opacity: 0.75; }
          100% { transform: rotateX(0deg); }
        }
        .flip-tile::before, .flip-tile::after {
          content: ""; position: absolute; top: 50%; width: 10px; height: 10px; background: #777;
          border-radius: 50%; transform: translateY(-50%);
        }
        .flip-tile::before { left: -5px; }
        .flip-tile::after { right: -5px; }
        .flip-label { margin-top: 6px; font-size: 12px; letter-spacing: .08em; font-weight: 700; opacity: .9; }
      `}</style>

      {/* ------- Jackpot header (bigger + flip clock) ------- */}
      <div className="jackpot-card">
        <div className="jackpot-grid">
          {/* Left: jackpot figures */}
          <div>
            <div className="jackpot-title">Current Jackpot</div>
            <div className="jackpot-amount">
              {jackpotSol.toFixed(4)} SOL {solPrice > 0 && <small>(~${jackpotUsd.toFixed(2)} USD)</small>}
            </div>

            <div style={{ marginTop: 18, fontWeight: 800, fontSize: 20 }}>Next Moon Draw</div>
            <div style={{ marginTop: 4, fontSize: 14 }}>
              <b>Next Draw:</b> {nextMoonDrawDate || "..."}
            </div>
            {/* countdown text removed */}
          </div>

          {/* Right: flip countdown */}
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, textAlign: "center" }}>
              Countdown
            </div>
            <div className="flip-row">
              <FlipTile value={remain.d} label="DAYS" />
              <FlipTile value={remain.h} label="HOURS" />
              <FlipTile value={remain.m} label="MINUTES" />
              <FlipTile value={remain.s} label="SECONDS" />
            </div>
          </div>
        </div>
      </div>

      {/* ------- Daily Check-In (added) ------- */}
      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>Daily Check-In</div>
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            Streak: <b>{streak}</b>{lastCheckin ? ` (last: ${lastCheckin.toLocaleDateString()})` : ""}
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <CheckInButton streak={streak} lastCheckin={lastCheckin} />
        </div>
      </div>

      {/* ------- Weekly free credit ------- */}
      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 600 }}>Weekly Free Ticket</div>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href={INTENT_X}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "transparent",
                color: "#fbbf24",
                border: "1px solid #fbbf24",
                borderRadius: 8,
                padding: "6px 10px",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              Post on X
            </a>
          </div>
        </div>

        <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.4, color: "#e5b400" }}>
          Claim your <b>free weekly Moonticket</b> in four quick steps:
          <span> 1) click <i>Post on X</i> to open a pre-filled post,</span>
          <span> 2) publish it,</span>
          <span> 3) copy the link to your post,</span>
          <span> 4) paste it below and press <i>Claim Free Ticket</i>.</span>
          You’re eligible for <b>one free ticket per drawing</b>.
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <input
            style={{ minWidth: 320, background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "6px 8px" }}
            value={tweetUrl}
            onChange={(e) => setTweetUrl(e.target.value)}
            placeholder="Paste tweet URL (required)"
          />
          <button
            style={{
              background: "#fbbf24",
              color: "#000",
              border: "none",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={claimFree}
            disabled={loading || !tweetOk}
          >
            Claim Free Ticket
          </button>
        </div>
        {!tweetOk && tweetUrl && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#fbbf24" }}>
            Enter a valid X/Twitter status URL (e.g., https://x.com/handle/status/12345).
          </div>
        )}
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
          Claim adds a <b>credit</b>. Use it at checkout on your next ticket.
        </div>
      </div>

      {/* ------- Buy TIX (embedded) ------- */}
      <div style={{ border: "1px solid #333", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Buy TIX</div>
        {!wallet ? (
          <div>Connect wallet to buy TIX.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div>
              <p>
                Live SOL: ${solPriceUsd?.toFixed(2) || "?"} | TIX: ${tixPriceUsd?.toFixed(5) || "?"}
              </p>
              <p style={{ opacity: 0.9, marginTop: 4 }}>SOL Balance: {solBalance?.toFixed(4) || "?"} SOL</p>

              {/* input + action aligned on one row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 8,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <label>Enter SOL:</label>
                <input
                  type="number"
                  value={solInput}
                  onChange={(e) => setSolInput(e.target.value)}
                  placeholder="e.g. 0.05"
                  style={{ background: "#fff", color: "#000", padding: "6px 8px", borderRadius: 6, width: 120 }}
                />
                <button
                  onClick={handleBuy}
                  disabled={loadingBuy || !solInput || Number(solInput) <= 0}
                  style={{
                    background: "#fbbf24",
                    color: "#000",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Buy TIX
                </button>
              </div>

              {wallet && solPriceUsd != null && tixPriceUsd != null && solTyped > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <p>USD est: <strong>${usdPreview.toFixed(2)}</strong></p>
                  <p>You’ll receive: <strong>{tixPreview.toLocaleString()}</strong> TIX</p>
                  <p>You’ll get: <strong>{creditsPreview}</strong> ticket credit{creditsPreview === 1 ? "" : "s"}</p>
                </div>
              )}

              {resultBuy && resultBuy.success ? (
                <div style={{ marginBottom: 8, color: "#9FE870" }}>
                  <p><strong>You’ll receive:</strong> {resultBuy.tixAmount.toLocaleString()} TIX</p>
                  <p>using {resultBuy.solAmount} SOL (~${resultBuy.usdSpent.toFixed(2)} USD)</p>
                  <p>Rate: ${resultBuy.tixPriceUsd?.toFixed(5)} | SOL: ${resultBuy.solPriceUsd?.toFixed(2)}</p>
                  {creditsEarned != null && (
                    <p className="mt-1">
                      You received <strong>{creditsEarned}</strong> ticket credit{creditsEarned === 1 ? "" : "s"}.
                    </p>
                  )}
                </div>
              ) : null}

              {resultBuy && !resultBuy.success && (
                <div style={{ marginTop: 8, color: "#ff6b6b" }}>
                  <p>{resultBuy.error || "An error occurred."}</p>
                </div>
              )}
            </div>

            {/* Right-side info about credits per 10k TIX */}
            <div style={{ borderLeft: "1px solid #333", paddingLeft: 12, color: "#e5b400" }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Moonticket Credits</div>
              <div style={{ fontSize: 14, lineHeight: 1.4 }}>
                For every <b>10,000 TIX</b> purchased you earn <b>1 Moonticket credit</b>.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ------- Builder instructions ------- */}
      <div style={{ marginBottom: 8, fontSize: 14, color: "#fbbf24", lineHeight: 1.4 }}>
        Use your available <b>credits</b> to generate tickets. Then click <b>Quick Pick</b> or <b>Add Ticket</b> to select numbers. When ready, click <b>Buy Tickets</b> to enter the drawing.
      </div>

      {/* ------- Build tickets ------- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          style={{ background: "transparent", color: "#fbbf24", border: "1px solid #fbbf24", borderRadius: 8, padding: "6px 10px", fontWeight: 600, cursor: "pointer" }}
          onClick={addQuickPick}
        >
          + Quick Pick
        </button>
        <button
          style={{ background: "transparent", color: "#fbbf24", border: "1px solid #fbbf24", borderRadius: 8, padding: "6px 10px", fontWeight: 600, cursor: "pointer" }}
          onClick={addBlankTicket}
        >
          + Add Ticket
        </button>
      </div>

      {cart.map((t, idx) => (
        <div key={idx} style={{ position: "relative", border: "1px solid #333", borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <button
            aria-label="Remove"
            title="Remove ticket"
            onClick={() => removeTicket(idx)}
            style={{ position: "absolute", top: 6, right: 8, background: "transparent", border: "none", color: "#bbb", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {["num1", "num2", "num3", "num4"].map((fieldKey) => (
              <select
                key={fieldKey}
                style={{ backgroundColor: "#fff", color: "#000", border: "1px solid #444", borderRadius: 6, padding: "4px 6px" }}
                value={t[fieldKey]}
                onChange={(e) => updateTicket(idx, { [fieldKey]: Number(e.target.value) })}
              >
                {MAIN_POOL.map((n) => (
                  <option key={n} value={n} disabled={isDisabledOption(idx, fieldKey, n)}>
                    {n}
                  </option>
                ))}
              </select>
            ))}

            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <span>Moonball</span>
              <select
                style={{ backgroundColor: "#fff", color: "#000", border: "1px solid #444", borderRadius: 6, padding: "4px 6px" }}
                value={t.moonball}
                onChange={(e) => updateTicket(idx, { moonball: Number(e.target.value) })}
              >
                {MOON_POOL.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </span>

            <button
              style={{ background: "transparent", color: "#fbbf24", border: "1px solid #fbbf24", borderRadius: 8, padding: "6px 10px", fontWeight: 600, cursor: "pointer" }}
              onClick={() => updateTicket(idx, quickPickOne())}
            >
              Quick Pick
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            4 unique 1–25 + Moonball 1–10.
          </div>
        </div>
      ))}

      {/* Totals */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginTop: 12 }}>
        <div><b>Total tickets:</b> {cart.length}</div>
        <div><b>Credits available:</b> {credits}</div>
        <div><b>Applying credits:</b> {ticketsToCredit}</div>
      </div>

      {/* Refresh */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 6, opacity: 0.9 }}>
        <button
          style={{ background: "transparent", color: "#fbbf24", border: "1px solid #fbbf24", borderRadius: 8, padding: "6px 10px", fontWeight: 600, cursor: "pointer" }}
          onClick={async () => { await fetchCredits(); await loadMyTickets(); }}
        >
          Refresh
        </button>
      </div>

      {/* Submit tickets (entry finalize) */}
      <div style={{ marginTop: 12 }}>
        <button
          style={{ background: "#fbbf24", color: "#000", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, cursor: "pointer" }}
          disabled={loading || !cart.length}
          onClick={async () => {
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
                headers: { "Content-Type": "application/json" },
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
                headers: { "Content-Type": "application/json" },
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
          }}
        >
          {loading ? "Processing..." : `Get Moontickets`}
        </button>
      </div>

      {/* Current tickets */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>My Tickets (current drawing)</div>
        {!myTickets.length ? (
          <div style={{ opacity: 0.8 }}>No tickets yet for the current drawing.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {myTickets.map((t) => (
              <li key={t.id} style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <TicketImages t={t} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Last drawing tickets */}
      <div style={{ marginTop: 24, borderTop: "1px solid #333", paddingTop: 16 }}>
        <button
          onClick={() => setPastOpen((o) => !o)}
          style={{ background: "transparent", color: "#fbbf24", border: "1px solid #fbbf24", borderRadius: 8, padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600, cursor: "pointer" }}
        >
          {pastOpen ? "▼" : "►"} Last Drawing Tickets
        </button>

        {pastOpen && (
          <div style={{ marginTop: 12 }}>
            {loadingPast ? (
              <div style={{ opacity: 0.8 }}>Loading…</div>
            ) : !pastItems.length ? (
              <div style={{ opacity: 0.8 }}>No tickets from the last drawing window.</div>
            ) : (
              <>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {pastItems.map((t) => (
                    <li key={t.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "nowrap" }}>
                        <TicketImages t={t} />
                      </div>
                      {(t.prize_sol > 0 || t.prize_tix > 0) && (
                        <div style={{ marginTop: 6, color: "#9FE870", fontWeight: 700 }}>
                          • WIN: {t.prize_sol > 0 ? `${t.prize_sol.toFixed(6)} SOL` : `${t.prize_tix.toLocaleString()} TIX`}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
                  <button
                    style={{ background: "transparent", color: "#fbbf24", border: "1px solid #fbbf24", borderRadius: 8, padding: "6px 10px", fontWeight: 600, cursor: "pointer" }}
                    onClick={() => setPastPage((p) => Math.max(1, p - 1))}
                    disabled={pastPage <= 1}
                  >
                    Prev
                  </button>
                  <span style={{ opacity: 0.9 }}>Page {pastPage} / {totalPages}</span>
                  <button
                    style={{ background: "transparent", color: "#fbbf24", border: "1px solid #fbbf24", borderRadius: 8, padding: "6px 10px", fontWeight: 600, cursor: "pointer" }}
                    onClick={() => setPastPage((p) => Math.min(totalPages, p + 1))}
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
