import { useEffect, useState, useMemo } from "react";

// --- Helper: render winning numbers using your images ---
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

// Tiers to display (order + labels)
const TIERS = [
  { key: "jackpot", label: "Jackpot", rule: "4 numbers + Moonball" },
  { key: "4",       label: "4",        rule: "4 numbers" },
  { key: "3+MB",    label: "3+MB",     rule: "3 numbers + Moonball" },
  { key: "3",       label: "3",        rule: "3 numbers" },
  { key: "2+MB",    label: "2+MB",     rule: "2 numbers + Moonball" },
  { key: "1+MB",    label: "1+MB",     rule: "1 number + Moonball" },
  { key: "0+MB",    label: "0+MB",     rule: "Moonball only" },
];

// Defensive readers for API shapes
function readTierCount(draw, key) {
  const v1 = draw?.tierCounts?.[key] ?? draw?.winners_by_tier?.[key];
  if (typeof v1 === "number") return v1;

  if (Array.isArray(draw?.tiers)) {
    const f = draw.tiers.find((t) => t.key === key || t.tier === key || t.name === key);
    if (f && typeof f.count === "number") return f.count;
  }

  const normalized = key.replace("+", "_plus_").replace("MB", "mb");
  const v2 =
    draw?.[key] ??
    draw?.[`count_${key}`] ??
    draw?.[`winners_${key}`] ??
    draw?.[`count_${normalized}`] ??
    draw?.[`winners_${normalized}`];
  return typeof v2 === "number" ? v2 : 0;
}

function readWinningNums(draw) {
  // Prefer normalized object from API
  if (draw?.winning_numbers) {
    const wn = draw.winning_numbers;
    return {
      nums: Array.isArray(wn.nums) ? wn.nums : [],
      moonball: wn.moonball ?? null,
    };
  }

  // Fallbacks: handle DB-style columns (win_num1..4, win_moonball) and older shapes
  const nums =
    [draw?.win_num1, draw?.win_num2, draw?.win_num3, draw?.win_num4].filter(
      (x) => typeof x === "number"
    ) ||
    [draw?.n1, draw?.n2, draw?.n3, draw?.n4].filter((x) => typeof x === "number") ||
    [];

  const moonball =
    typeof draw?.win_moonball === "number"
      ? draw.win_moonball
      : draw?.moonball ?? draw?.mb ?? null;

  return { nums, moonball };
}

// Normalize any response shape into an array of draws
function normalizeDrawList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.draws)) return data.draws;
  if (Array.isArray(data.results)) return data.results;
  // Sometimes API wraps success:
  if (typeof data === "object") {
    for (const k of Object.keys(data)) {
      if (Array.isArray(data[k])) return data[k];
    }
  }
  return [];
}

export default function PastDrawings() {
  const [draws, setDraws] = useState([]);
  const [i, setI] = useState(0); // current index (0 = most recent)
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // Primary request
        let res = await fetch("/api/pastDraws");
        let data = await res.json().catch(() => ({}));
        let list = normalizeDrawList(data);

        // If still empty, try with a generous limit as a fallback
        if (!list.length) {
          res = await fetch("/api/pastDraws?limit=100");
          data = await res.json().catch(() => ({}));
          list = normalizeDrawList(data);
        }

        // newest first
        const sorted = [...list].sort((a, b) => {
          const da = new Date(a?.draw_date || a?.date || 0).getTime();
          const db = new Date(b?.draw_date || b?.date || 0).getTime();
          return db - da;
        });

        setDraws(sorted);
        setI(0);
      } catch (e) {
        setErr("Failed to load past draws.");
        setDraws([]);
      } finally {
        setLoading(false);
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
  const jackpotSol = Number(draw?.jackpot_sol || draw?.jackpotSol || 0);
  const dt = draw?.draw_date ? new Date(draw.draw_date) : draw?.date ? new Date(draw.date) : null;

  return (
    <div className="flex flex-col min-h-screen bg-black text-yellow-400 overflow-x-hidden">
      <main className="flex-grow px-4 sm:px-6 pt-40 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-4">Past Drawings</h1>

        {loading ? (
          <p>Loading…</p>
        ) : !draw ? (
          <div>
            <p>No draws yet.</p>
            {err ? <p className="text-yellow-300/80 text-sm mt-2">{err}</p> : null}
            {!err && draws && Array.isArray(draws) && draws.length === 0 ? (
              <p className="text-yellow-300/60 text-xs mt-1">API returned an empty list.</p>
            ) : null}
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
                      <td className="px-3 py-2 text-right">{readTierCount(draw, t.key)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Optional: jackpot winner address if provided */}
            <div className="mt-4">
              <div className="font-semibold">Winner</div>
              <div className="break-all">
                {draw.rolled_over ? "None (Rolled Over)" : draw.winner || "—"}
              </div>
            </div>

            {draw.tx_signature && (
              <div className="mt-2">
                <a
                  href={`https://solscan.io/tx/${draw.tx_signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-400 break-all"
                >
                  View transaction on Solscan
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
