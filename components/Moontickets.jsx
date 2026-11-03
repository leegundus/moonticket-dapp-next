import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import useCountdown from "../hooks/useCountdown";
import useEntries from "../hooks/useEntries";
import useCurrentDraw from "../hooks/useCurrentDraw";

function prizeText(item) {
  const amount = item?.amount ? String(item.amount) : "";
  if (item?.type === "TIX") return amount ? amount + " TIX" : "TIX";
  if (item?.type === "SOL") return amount ? amount + " SOL" : "SOL";
  if (item?.type === "TOKEN") return [amount, item?.label || "Token"].filter(Boolean).join(" ");
  return item?.label || item?.description || item?.type || "Prize";
}

export default function Moontickets() {
  const { publicKey } = useWallet();
  const { moonCountdown, nextMoonDrawDate } = useCountdown();
  const entryData = useEntries(publicKey);
  const current = useCurrentDraw();
  const [claiming, setClaiming] = useState(false);
  const [claimedNow, setClaimedNow] = useState(false);
  const [message, setMessage] = useState("");

  const wallet = publicKey?.toBase58();
  const alreadyEntered = claimedNow || (entryData?.freeEntries || 0) > 0;
  const prizes = Array.isArray(current?.draw?.prize_bundle) ? current.draw.prize_bundle : [];

  const shareText = encodeURIComponent(
    "I entered this week's free MoonTicket drawing. One guaranteed winner every week. No purchase necessary. https://moonticket.io @moonticket__io"
  );
  const shareUrl = "https://x.com/intent/post?text=" + shareText;

  async function claimFreeEntry() {
    if (!wallet) {
      setMessage("Connect a Solana wallet first.");
      return;
    }

    setClaiming(true);
    setMessage("");

    try {
      const res = await fetch("/api/claimFreeEntry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });

      const raw = await res.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

      if (!data) throw new Error("The MoonTicket entry service returned an invalid response.");
      if (res.status === 409 || data?.alreadyClaimed) {
        setClaimedNow(true);
        setMessage("You are already entered in this week's drawing.");
        return;
      }
      if (!res.ok || !data?.success) throw new Error(data?.error || "Could not claim your weekly entry.");

      setClaimedNow(true);
      setMessage("You're in! Your free entry is confirmed for this week's drawing.");
    } catch (err) {
      setMessage(err?.message || "Could not claim your weekly entry.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto pb-20">
      <div className="border border-yellow-400/50 rounded-xl p-6 text-center mb-6">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-300">This Week&apos;s Prize Bundle</div>

        {current.loading ? (
          <div className="text-2xl font-bold mt-3">Loading prize…</div>
        ) : prizes.length ? (
          <div className="mt-3 space-y-2">
            {prizes.map((item, index) => (
              <div key={index} className="text-3xl md:text-4xl font-bold">{prizeText(item)}</div>
            ))}
          </div>
        ) : (
          <div className="text-2xl md:text-3xl font-bold mt-3">Prize announcement coming soon</div>
        )}

        <div className="mt-5 text-lg font-semibold">One guaranteed winner every week</div>
        <div className="mt-2 text-sm opacity-90">Drawing: {nextMoonDrawDate || "Monday at 10:00 PM CT"}</div>
        <div className="text-sm opacity-90">Countdown: {moonCountdown || "—"}</div>
      </div>

      <div className="border border-yellow-400/30 rounded-xl p-6 text-center">
        <h2 className="text-2xl font-bold mb-3">Claim Your Free Weekly Entry</h2>
        <p className="mb-5 leading-relaxed">
          No purchase is necessary. Buying or holding TIX does not increase your odds.
          Each eligible wallet receives one entry for the weekly drawing.
        </p>

        {!publicKey ? (
          <p className="font-semibold">Connect your Solana wallet to enter.</p>
        ) : alreadyEntered ? (
          <div>
            <div className="text-green-400 text-xl font-bold">✓ You&apos;re entered this week</div>
            <p className="mt-2 text-sm opacity-90 break-all">Wallet: {wallet}</p>
          </div>
        ) : (
          <button
            onClick={claimFreeEntry}
            disabled={claiming}
            className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg disabled:opacity-50"
          >
            {claiming ? "Claiming..." : "Enter This Week's Drawing — Free"}
          </button>
        )}

        {message && <p className="mt-4 text-sm">{message}</p>}

        {alreadyEntered && (
          <div className="mt-6">
            <p className="text-sm mb-3">Want to help MoonTicket grow? Sharing is optional.</p>
            <a href={shareUrl} target="_blank" rel="noopener noreferrer"
              className="inline-block border border-yellow-400 rounded-lg px-4 py-2 font-semibold">
              Share on X
            </a>
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-sm opacity-90">
        <p>Current entries for this wallet: {alreadyEntered ? 1 : 0}</p>
        <p className="mt-1">Past winners and payout transactions are published for transparency.</p>
      </div>

      <div className="mt-10 text-center px-4">
        <p className="text-xs text-yellow-300/80 max-w-2xl mx-auto leading-relaxed">
          No purchase necessary to enter or win. Buying or holding TIX does not improve drawing odds.
          Final eligibility requirements and official rules will be published before the first public drawing.
          Void where prohibited.
        </p>
      </div>
    </div>
  );
}
