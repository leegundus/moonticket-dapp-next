import { useEffect, useMemo, useState } from "react";

/* ---------- Winning numbers (image chips) ---------- */
function WinningNumbers({ nums = [], moonball = null, size = 56 }) {
  const ordered = Array.isArray(nums) ? [...nums].sort((a, b) => a - b) : [];
  const ball = { width: size, height: size, objectFit: "contain" };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {ordered.map((n, i) => (
        <img key={`n${i}`} src={`/numbers/yellow/${n}.png`} alt={`${n}`} style={ball} />
      ))}
      {moonball != null && (
        <img src={`/numbers/green/${moonball}.png`} alt={`MB ${moonball}`} style={{ ...ball, marginLeft: 6 }} />
      )}
    </div>
  );
}

/* ---------- Tiers (display order) ---------- */
const TIERS = [
  { key: "jackpot", label: "Jackpot", rule: "4 numbers + Moonball" },
  { key: "4",       label: "4",       rule: "4 numbers" },
  { key: "3+MB",    label: "3+MB",    rule: "3 numbers + Moonball" },
  { key: "3",       label: "3",       rule: "3 numbers" },
  { key: "2+MB",    label: "2+MB",    rule: "2 numbers + Moonball" },
  { key: "1+MB",    label: "1+MB",    rule: "1 number + Moonball" },
  { key: "0+MB",    label: "0+MB",    rule: "Moonball only" },
];

/* ---------- Helpers to read counts from /api/pastDraws ---------- */
function readTierCount(draw, key) {
  // Prefer nested objects if present
  const v1 = draw?.tierCounts?.[key] ?? draw?.winners_by_tier?.[key];
  if (typeof v1 === "number") return v1;

  // Some APIs ship an array of tiers with {key,count}
  if (Array.isArray(draw?.tiers)) {
    const f = draw.tiers.find((t) => t.key === key || t.tier === key || t.name === key);
    if (f && typeof f.count === "number") return f.count;
  }

  // Fallback to flat properties with different namings
  const normalized = key.replace("+", "_plus_").replace("MB", "mb");
  const v2 =
    draw?.[key] ??
    draw?.[`count_${key}`] ??
    draw?.[`winners_${key}`] ??
    draw?.[`count_${normalized}`] ??
    draw?.[`winners_${normalized}`];
  return typeof v2 === "number" ? v2 : 0;
}

function readWinningNums(draw = {}) {
  const wn = draw.winning_numbers || draw.winningNumbers || {};
  const nums =
    wn.nums ||
    wn.main ||
    [wn.n1, wn.n2, wn.n3, wn.n4].filter((x) => typeof x === "number") ||
    [draw.win_num1, draw.win_num2, draw.win_num3, draw.win_num4].filter((x) => typeof x === "number") ||
    [draw.n1, draw.n2, draw.n3, draw.n4].filter((x) => typeof x === "number");
  const moonball = wn.moonball ?? draw.win_moonball ?? wn.mb ?? draw.moonball ?? draw.mb;
  return { nums: Array.isArray(nums) ? nums : [], moonball };
}

/* ========================= Page ========================= */
export default function PastDrawings() {
  const [draws, setDraws] = useState([]);
  const [i, setI] = useState(0); // current index (0 = most recent)

  // Load draw list (ONLY this endpoint)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/pastDraws");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.items || [];
        // newest first if API returned oldest first
        const sorted =
          list.length && new Date(list[0]?.draw_date) < new Date(list[list.length - 1]?.draw_date)
            ? [...list].reverse()
            : list;
        setDraws(sorted);
        setI(0);
      } catch {
        setDraws([]);
      }
    })();
  }, []);

  // keyboard arrow nav
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      if (e.key === "ArrowRight") setI((x) => Math.min(draws.length - 1, x + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draws.length]);

  const draw = useMemo(() => (draws.length ? draws[i] : null), [draws, i]);
  const { nums, moonball } = readWinningNums(draw || {});
  const treasurySol = Number(draw?.jackpot_sol || 0);
  const dt = draw?.draw_date ? new Date(draw.draw_date) : null;

  // Winner counts (all tiers) from the same payload
  const counts = useMemo(() => {
    const out = {};
    for (const t of TIERS) out[t.key] = readTierCount(draw || {}, t.key);
    return out;
  }, [draw]);

  // Jackpot math (80% of treasury divided by number of jackpot winners)
  const jackpotWinners =
    counts.jackpot ||
    Number(draw?.jackpot_winners || 0); // optional alt field if your API has it
  const totalJackpotSol = treasurySol > 0 ? treasurySol * 0.8 : 0;
  const perWinnerSol =
    jackpotWinners > 0 && totalJackpotSol > 0
      ? totalJackpotSol / jackpotWinners
      : 0;

  // Optional array of per-winner payout txs if you choose to add later
  const jackpotTxSigs = Array.isArray(draw?.jackpot_tx_sigs) ? draw.jackpot_tx_sigs : [];

  return (
    <div className="flex flex-col min-h-screen bg-black text-yellow-400 overflow-x-hidden">
      <main className="flex-grow px-4 sm:px-6 pt-40 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-4">Past Drawings</h1>

        {!draw ? (
          <div>
            <p>No draws yet.</p>
            <p className="opacity-70 text-sm mt-1">API returned an empty list.</p>
          </div>
        ) : (
          <div className="border border-yellow-600 rounded p-4">
            {/* Header: date + pager */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-semibold">Date</div>
                <div>{dt ? dt.toLocaleString() : "—"}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setI((x) => Math.max(0, x - 1))}
                  disabled={i <= 0}
                  className="px-3 py-1 border border-yellow-500 rounded disabled:opacity-40"
                >
                  ◀
                </button>
                <div className="text-sm opacity-80">
                  {i + 1} / {draws.length}
                </div>
                <button
                  onClick={() => setI((x) => Math.min(draws.length - 1, x + 1))}
                  disabled={i >= draws.length - 1}
                  className="px-3 py-1 border border-yellow-500 rounded disabled:opacity-40"
                >
                  ▶
                </button>
              </div>
            </div>

            {/* Jackpot snapshot */}
            <div className="mt-3">
              <div className="font-semibold">Jackpot (SOL)</div>
              <div>{treasurySol.toFixed(4)}</div>
              {jackpotWinners > 0 && (
                <div className="text-sm opacity-85 mt-1">
                  {`Paid pool (80%): ${totalJackpotSol.toFixed(6)} SOL • `}
                  {`Winners: ${jackpotWinners} • `}
                  {`~${perWinnerSol.toFixed(6)} SOL each`}
                </div>
              )}
            </div>

            {/* Winning numbers */}
            <div className="mt-4">
              <div className="text-sm opacity-85 mb-1 font-semibold">Winning Numbers</div>
              <WinningNumbers nums={nums} moonball={moonball} />
            </div>

            {/* Tier breakdown */}
            <div className="mt-5 overflow-hidden rounded border border-yellow-300/30">
              <table className="w-full text-sm">
                <thead className="bg-yellow-300/10">
                  <tr>
                    <th className="px-3 py-2 text-left">Tier</th>
                    <th className="px-3 py-2 text-left">Match Requirement</th>
                    <th className="px-3 py-2 text-right">Winners</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-yellow-300/10">
                  {TIERS.map((t) => (
                    <tr key={t.key} className="hover:bg-yellow-300/5">
                      <td className="px-3 py-2 font-semibold">{t.label}</td>
                      <td className="px-3 py-2">{t.rule}</td>
                      <td className="px-3 py-2 text-right">{counts[t.key] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Optional: per-winner payout txs if your API includes them */}
            {jackpotTxSigs.length > 0 && (
              <div className="mt-4">
                <div className="font-semibold mb-1">Jackpot Payout Transactions</div>
                <ul className="list-disc ml-5 space-y-1">
                  {jackpotTxSigs.map((sig, idx) => (
                    <li key={idx} className="break-all">
                      <a
                        href={`https://solscan.io/tx/${sig}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-blue-400"
                      >
                        {sig}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Legacy single-winner field (if present) */}
            <div className="mt-4">
              <div className="font-semibold">Winner</div>
              <div className="break-all">
                {draw?.rolled_over ? "None (Rolled Over)" : draw?.winner || "—"}
              </div>
            </div>

            {/* Main transaction for the draw (if provided) */}
            {draw?.tx_signature && (
              <div className="mt-2">
                <a
                  href={`https://solscan.io/tx/${draw.tx_signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-400 break-all"
                >
                  View draw transaction on Solscan
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
