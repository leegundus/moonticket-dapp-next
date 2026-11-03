import { useEffect, useMemo, useState } from "react";

function shortAddr(value) {
  if (!value || typeof value !== "string") return "—";
  return value.length <= 14 ? value : value.slice(0, 6) + "…" + value.slice(-6);
}

function prizeText(item) {
  const amount = item?.amount ? String(item.amount) : "";
  if (item?.type === "TIX") return amount ? amount + " TIX" : "TIX";
  if (item?.type === "SOL") return amount ? amount + " SOL" : "SOL";
  if (item?.type === "TOKEN") return [amount, item?.label || "Token"].filter(Boolean).join(" ");
  return item?.label || item?.description || item?.type || "Prize";
}

export default function PastDrawings() {
  const [draws, setDraws] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/pastDraws");
        const data = await res.json();
        setDraws(Array.isArray(data?.items) ? data.items : []);
      } catch {
        setDraws([]);
      }
    })();
  }, []);

  const draw = useMemo(() => draws[index] || null, [draws, index]);
  const prizes = Array.isArray(draw?.prize_bundle) ? draw.prize_bundle : [];
  const signatures = Array.isArray(draw?.payout_tx_signatures)
    ? draw.payout_tx_signatures
    : draw?.tx_signature ? [draw.tx_signature] : [];

  return (
    <div className="min-h-screen bg-black text-yellow-400 px-4 sm:px-6 pt-40 pb-16">
      <main className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Past Winners</h1>
        <p className="mb-8 opacity-90">One guaranteed winner per weekly MoonTicket drawing.</p>

        {!draw ? (
          <div className="border border-yellow-400/30 rounded-xl p-6">No weekly winners recorded yet.</div>
        ) : (
          <div className="border border-yellow-500 rounded-xl p-6">
            <div className="flex justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm opacity-80">Drawing</div>
                <div className="font-semibold">{draw.draw_key || new Date(draw.draw_date).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}
                  className="border border-yellow-400 rounded px-3 py-1 disabled:opacity-30">Newer</button>
                <span className="text-sm">{index + 1} / {draws.length}</span>
                <button onClick={() => setIndex((i) => Math.min(draws.length - 1, i + 1))}
                  disabled={index >= draws.length - 1}
                  className="border border-yellow-400 rounded px-3 py-1 disabled:opacity-30">Older</button>
              </div>
            </div>

            <div className="mt-8">
              <div className="text-sm opacity-80">Winner</div>
              <div className="text-2xl font-bold">{shortAddr(draw.winner)}</div>
              <div className="text-xs mt-1 break-all opacity-80">{draw.winner}</div>
            </div>

            <div className="mt-8">
              <div className="text-sm opacity-80">Prize Bundle</div>
              {prizes.length ? (
                <div className="mt-2 space-y-1">
                  {prizes.map((item, i) => <div key={i} className="text-xl font-semibold">{prizeText(item)}</div>)}
                </div>
              ) : <div className="text-xl font-semibold">Prize recorded separately</div>}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <div>
                <div className="text-sm opacity-80">Entries</div>
                <div className="text-xl font-semibold">{Number(draw.entries || 0)}</div>
              </div>
              <div>
                <div className="text-sm opacity-80">Payout</div>
                <div className="text-xl font-semibold">{draw.payout_status === "paid" ? "Paid" : "Pending"}</div>
              </div>
            </div>

            {draw.randomness_blockhash && (
              <div className="mt-8 text-xs opacity-80 break-all">
                <div>Randomness slot: {draw.randomness_slot}</div>
                <div>Solana blockhash: {draw.randomness_blockhash}</div>
              </div>
            )}

            {signatures.map((sig, i) => (
              <a key={sig} href={"https://solscan.io/tx/" + sig} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-6 mr-4 underline text-blue-400">
                Verify payout {signatures.length > 1 ? i + 1 : ""} on Solscan
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
