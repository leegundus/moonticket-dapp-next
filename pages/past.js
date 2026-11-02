import { useEffect, useMemo, useState } from "react";

function shortAddr(value) {
  if (!value || typeof value !== "string") return "—";
  return value.length <= 14 ? value : value.slice(0, 6) + "…" + value.slice(-6);
}

function winnerFromDraw(draw) {
  if (draw?.winner) return { wallet: draw.winner, tx: draw?.tx_signature || null };
  if (Array.isArray(draw?.jackpot_winners) && draw.jackpot_winners.length) {
    const winner = draw.jackpot_winners[0];
    return { wallet: winner?.wallet || null, tx: winner?.tx_sig || draw?.tx_signature || null };
  }
  return { wallet: null, tx: draw?.tx_signature || null };
}

export default function PastDrawings() {
  const [draws, setDraws] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/pastDraws");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.items || [];
        setDraws(list);
      } catch {
        setDraws([]);
      }
    })();
  }, []);

  const draw = useMemo(() => draws[index] || null, [draws, index]);
  const winner = winnerFromDraw(draw);
  const prize = Number(draw?.jackpot_sol || draw?.jackpotSol || 0);
  const entries = Number(draw?.entries || 0);

  return (
    <div className="min-h-screen bg-black text-yellow-400 px-4 sm:px-6 pt-40 pb-16">
      <main className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Past Winners</h1>
        <p className="mb-8 opacity-90">One winner per weekly MoonTicket drawing.</p>

        {!draw ? (
          <div className="border border-yellow-400/30 rounded-xl p-6">No drawings recorded yet.</div>
        ) : (
          <div className="border border-yellow-500 rounded-xl p-6">
            <div className="flex justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm opacity-80">Drawing</div>
                <div className="font-semibold">
                  {draw?.draw_date ? new Date(draw.draw_date).toLocaleString() : "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  className="border border-yellow-400 rounded px-3 py-1 disabled:opacity-30"
                >
                  Newer
                </button>
                <span className="text-sm">{index + 1} / {draws.length}</span>
                <button
                  onClick={() => setIndex((i) => Math.min(draws.length - 1, i + 1))}
                  disabled={index >= draws.length - 1}
                  className="border border-yellow-400 rounded px-3 py-1 disabled:opacity-30"
                >
                  Older
                </button>
              </div>
            </div>

            <div className="mt-8">
              <div className="text-sm opacity-80">Winner</div>
              <div className="text-2xl font-bold break-all">
                {winner.wallet ? shortAddr(winner.wallet) : "No winner recorded"}
              </div>
              {winner.wallet && <div className="text-xs mt-1 break-all opacity-80">{winner.wallet}</div>}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <div>
                <div className="text-sm opacity-80">Prize</div>
                <div className="text-xl font-semibold">{prize.toFixed(4)} SOL</div>
              </div>
              <div>
                <div className="text-sm opacity-80">Entries</div>
                <div className="text-xl font-semibold">{entries}</div>
              </div>
            </div>

            {winner.tx && (
              <a
                href={"https://solscan.io/tx/" + winner.tx}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-8 underline text-blue-400"
              >
                Verify payout on Solscan
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
