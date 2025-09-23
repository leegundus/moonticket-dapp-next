import { useEffect, useState, useMemo } from "react";

// --- Render the winning numbers using your images ---
function WinningNumbers({ nums = [], moonball = null, size = 80 }) {
  const ordered = Array.isArray(nums) ? [...nums].sort((a, b) => a - b) : [];
  // Fit 5 balls across the content width on small screens:
  // - 80px max (desktop/tablet)
  // - calc((100vw - 2rem)/5) on phones (2rem = px-4 horizontal padding on <main>)
  // - never shrink below 56px to keep them readable
  const responsiveSide = `clamp(56px, calc((100vw - 2rem)/5), ${size}px)`;
  const ball = { width: responsiveSide, height: responsiveSide, objectFit: "contain" };

  return (
    <div className="flex items-center justify-between gap-0.5 sm:gap-2 w-full">
      {ordered.map((n, i) => (
        <img key={`n${i}`} src={`/numbers/yellow/${n}.png`} alt={`${n}`} style={ball} />
      ))}
      {moonball != null && (
        <img src={`/numbers/green/${moonball}.png`} alt={`MB ${moonball}`} style={ball} />
      )}
    </div>
  );
}

const TIERS = [
  { key: "jackpot", label: "Jackpot", rule: "4 numbers + Moonball" },
  { key: "4",       label: "4",       rule: "4 numbers" },
  { key: "3+MB",    label: "3+MB",    rule: "3 numbers + Moonball" },
  { key: "3",       label: "3",       rule: "3 numbers" },
  { key: "2+MB",    label: "2+MB",    rule: "2 numbers + Moonball" },
  { key: "1+MB",    label: "1+MB",    rule: "1 number + Moonball" },
  { key: "0+MB",    label: "0+MB",    rule: "Moonball only" },
];

// Prize labels per tier
const PRIZES = {
  jackpot: "Jackpot (SOL)",
  "4": "250,000 TIX",
  "3+MB": "100,000 TIX",
  "3": "50,000 TIX",
  "2+MB": "20,000 TIX",
  "1+MB": "15,000 TIX",
  "0+MB": "10,000 TIX",
};

// read tier count defensively from the API shape
function readTierCount(draw, key) {
  const v1 = draw?.tierCounts?.[key] ?? draw?.winners_by_tier?.[key];
  if (typeof v1 === "number") return v1;

  if (Array.isArray(draw?.tiers)) {
    const f = draw.tiers.find((t) => t.key === key || t.tier === key || t.name === key);
    if (f && typeof f.count === "number") return f.count;
  }

  const norm = key.replace("+", "_plus_").replace("MB", "mb");
  const v2 =
    draw?.[key] ??
    draw?.[`count_${key}`] ??
    draw?.[`winners_${key}`] ??
    draw?.[`count_${norm}`] ??
    draw?.[`winners_${norm}`];

  return typeof v2 === "number" ? v2 : 0;
}

function readWinningNums(draw) {
  const wn = draw?.winning_numbers || draw?.winningNumbers || {};
  const nums =
    wn.nums ||
    wn.main ||
    [wn.n1, wn.n2, wn.n3, wn.n4].filter((x) => typeof x === "number") ||
    [draw?.n1, draw?.n2, draw?.n3, draw?.n4].filter((x) => typeof x === "number");
  const moonball = wn.moonball ?? draw?.moonball ?? wn?.mb ?? draw?.mb;
  return { nums: Array.isArray(nums) ? nums : [], moonball };
}

function shortAddr(a) {
  if (!a || typeof a !== "string") return "";
  return a.length <= 10 ? a : `${a.slice(0, 4)}…${a.slice(-4)}`;
}

export default function PastDrawings() {
  const [draws, setDraws] = useState([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/pastDraws");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.items || [];
        // newest first (fallback if API returns oldest first)
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

  // keyboard nav
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
  const jackpotSol = Number(draw?.jackpot_sol || draw?.jackpotSol || 0);
  const dt = draw?.draw_date ? new Date(draw.draw_date) : null;

  const jackpotWinners = Array.isArray(draw?.jackpot_winners) ? draw.jackpot_winners : null;

  return (
    <div className="flex flex-col min-h-screen bg-black text-yellow-400 overflow-x-hidden">
      <main className="flex-grow px-4 sm:px-6 pt-40 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-4">Past Drawings</h1>

        {!draw ? (
          <div>
            <p>No draws yet.</p>
            <p className="text-yellow-300/80 text-sm mt-1">API returned an empty list.</p>
          </div>
        ) : (
          <div className="border border-yellow-600 rounded p-4">
            {/* Header */}
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
                <div className="text-sm opacity-80">{i + 1} / {draws.length}</div>
                <button
                  onClick={() => setI((x) => Math.min(draws.length - 1, x + 1))}
                  disabled={i >= draws.length - 1}
                  className="px-3 py-1 border border-yellow-500 rounded disabled:opacity-40"
                >
                  ▶
                </button>
              </div>
            </div>

            {/* Jackpot */}
            <div className="mt-3">
              <div className="font-semibold">Jackpot (SOL)</div>
              <div>{jackpotSol.toFixed(4)}</div>
            </div>

            {/* Winning numbers */}
            <div className="mt-4">
              <div className="text-sm opacity-85 mb-1 font-semibold">Winning Numbers</div>
              <WinningNumbers nums={nums} moonball={moonball} />
            </div>

            {/* Tier table */}
            <div className="mt-5 overflow-hidden rounded border border-yellow-300/30">
              <table className="w-full text-sm">
                <thead className="bg-yellow-300/10">
                  <tr>
                    <th className="px-3 py-2 text-left">Tier</th>
                    <th className="px-3 py-2 text-left">Match Requirement</th>
                    <th className="px-3 py-2 text-left">Prize</th>
                    <th className="px-3 py-2 text-right">Winners</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-yellow-300/10">
                  {TIERS.map((t) => (
                    <tr key={t.key} className="hover:bg-yellow-300/5">
                      <td className="px-3 py-2 font-semibold">{t.label}</td>
                      <td className="px-3 py-2">{t.rule}</td>
                      <td className="px-3 py-2">{PRIZES[t.key]}</td>
                      <td className="px-3 py-2 text-right">{readTierCount(draw, t.key)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Jackpot Winners (addresses + SolScan link) — always shown */}
            <div className="mt-5">
              <div className="font-semibold mb-1">Jackpot Winners</div>
              {(jackpotWinners && jackpotWinners.length > 0) ? (
                <ul className="space-y-1">
                  {jackpotWinners.map((w, idx) => (
                    <li key={idx} className="break-all">
                      <span className="mr-2">{w.wallet || "—"}</span>
                      {w.tx_sig ? (
                        <a
                          href={`https://solscan.io/tx/${w.tx_sig}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-blue-400"
                        >
                          SolScan Link
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : draw?.winner ? (
                <div className="break-all">{draw.winner}</div>
              ) : (
                <div className="opacity-80">No jackpot winners this drawing.</div>
              )}
            </div>

            {/* Transaction link for the jackpot funding (if any) */}
            {draw?.tx_signature && (
              <div className="mt-3">
                <a
                  href={`https://solscan.io/tx/${draw.tx_signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-400 break-all"
                >
                  SolScan Link (jackpot funding)
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
