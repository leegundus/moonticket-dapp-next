import { useEffect, useState, useMemo } from "react";

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

/* ---------- Display tiers ---------- */
const TIERS = [
  { key: "jackpot", label: "Jackpot", rule: "4 numbers + Moonball" },
  { key: "4",       label: "4",       rule: "4 numbers" },
  { key: "3+MB",    label: "3+MB",    rule: "3 numbers + Moonball" },
  { key: "3",       label: "3",       rule: "3 numbers" },
  { key: "2+MB",    label: "2+MB",    rule: "2 numbers + Moonball" },
  { key: "1+MB",    label: "1+MB",    rule: "1 number + Moonball" },
  { key: "0+MB",    label: "0+MB",    rule: "Moonball only" },
];

/* ---------- Helpers to read/compute counts ---------- */

function normTierString(v) {
  return String(v || "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Map a single award row to our display tier key. */
function awardToTierKey(a = {}) {
  const tierStr = normTierString(a.tier ?? a.tier_name ?? a.level);
  const matches = Number(a.matches ?? a.match_count ?? a.num_matches ?? 0);
  const mb = Boolean(a.moonball_mat ?? a.moonball ?? a.mb ?? a.moonball_match);

  if (tierStr === "JACKPOT") return "jackpot";
  if (["4","3+MB","3","2+MB","1+MB","0+MB"].includes(tierStr)) return tierStr;

  if (matches === 4 && mb) return "jackpot";
  if (matches === 4 && !mb) return "4";
  if (matches === 3 && mb) return "3+MB";
  if (matches === 3 && !mb) return "3";
  if (matches === 2 && mb) return "2+MB";
  if (matches === 1 && mb) return "1+MB";
  if (matches === 0 && mb) return "0+MB";

  return null;
}

/** Build counts object from an array of award rows. */
function countsFromAwards(awards = []) {
  const out = { jackpot: 0, "4": 0, "3+MB": 0, "3": 0, "2+MB": 0, "1+MB": 0, "0+MB": 0 };
  for (const a of Array.isArray(awards) ? awards : []) {
    const key = awardToTierKey(a);
    if (key && key in out) out[key] += 1;
  }
  return out;
}

/** Gather winning numbers from various shapes. */
function readWinningNums(draw) {
  const wn = draw?.winning_numbers || draw?.winningNumbers || {};
  const nums =
    wn.nums ||
    wn.main ||
    [wn.n1, wn.n2, wn.n3, wn.n4].filter((x) => typeof x === "number") ||
    [draw.win_num1, draw.win_num2, draw.win_num3, draw.win_num4].filter((x) => typeof x === "number") ||
    [draw.n1, draw.n2, draw.n3, draw.n4].filter((x) => typeof x === "number");
  const moonball = wn.moonball ?? draw.win_moonball ?? wn.mb ?? draw.moonball ?? draw.mb;
  return { nums: Array.isArray(nums) ? nums : [], moonball };
}

/** Read a tier count with graceful fallbacks; prefer the largest. */
function readTierCount(draw, key, computedCounts) {
  let best = 0;

  const v1 = draw?.tierCounts?.[key] ?? draw?.winners_by_tier?.[key];
  if (typeof v1 === "number") best = Math.max(best, v1);

  if (Array.isArray(draw?.tiers)) {
    const f = draw.tiers.find((t) => t.key === key || t.tier === key || t.name === key);
    if (f && typeof f.count === "number") best = Math.max(best, f.count);
  }

  const normalized = key.replace("+", "_plus_").replace("MB", "mb");
  const v2 =
    draw?.[key] ??
    draw?.[`count_${key}`] ??
    draw?.[`winners_${key}`] ??
    draw?.[`count_${normalized}`] ??
    draw?.[`winners_${normalized}`];
  if (typeof v2 === "number") best = Math.max(best, v2);

  if (computedCounts && typeof computedCounts[key] === "number") {
    best = Math.max(best, computedCounts[key]);
  }

  if (key === "jackpot") {
    const byWinnerField = !draw?.rolled_over && (draw?.winner ? 1 : 0);
    const jackpotList =
      Array.isArray(draw?.jackpot_winners) ? draw?.jackpot_winners.length : 0;
    best = Math.max(best, byWinnerField, jackpotList || 0);
  }

  return best;
}

/* ---------- Page ---------- */
export default function PastDrawings() {
  const [draws, setDraws] = useState([]);
  const [i, setI] = useState(0); // 0 = most recent

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/pastDraws");
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.items || [];
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
  const treasurySol = Number(draw?.jackpot_sol || draw?.jackpotSol || 0); // treasury at draw time
  const dt = draw?.draw_date ? new Date(draw.draw_date) : null;

  // awards array (for payout txs and counts)
  const awards = useMemo(
    () => draw?.awards || draw?.prize_awards || draw?.winners || [],
    [draw]
  );
  const computedCounts = useMemo(() => countsFromAwards(awards), [awards]);

  // Jackpot totals
  const jackpotWinners = readTierCount(draw, "jackpot", computedCounts);
  // If your API ever sends the pre-80% treasury, compute 80% as the jackpot pool:
  const totalJackpotSol =
    Number(draw?.jackpot_payout_sol ?? draw?.jackpot_sol_payout) ||
    (treasurySol > 0 ? treasurySol * 0.8 : 0);

  const perWinnerSol =
    jackpotWinners > 0 && totalJackpotSol > 0
      ? totalJackpotSol / jackpotWinners
      : 0;

  // Jackpot payout txs (and wallets), if present
  const jackpotAwards = Array.isArray(awards)
    ? awards.filter((a) => awardToTierKey(a) === "jackpot")
    : [];

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

            {/* Jackpot (treasury/overview) */}
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
                      <td className="px-3 py-2 text-right">
                        {readTierCount(draw, t.key, computedCounts)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Jackpot payout transactions (Solscan) */}
            {jackpotAwards.length > 0 && (
              <div className="mt-4">
                <div className="font-semibold mb-1">Jackpot Payout Transactions</div>
                <ul className="list-disc ml-5 space-y-1">
                  {jackpotAwards.map((a, idx) => {
                    const tx = a.tx_sig || a.tx_signature || a.sig || a.signature;
                    const wallet = a.wallet || a.to || a.recipient;
                    return (
                      <li key={idx} className="break-all">
                        {wallet ? <span className="opacity-90">{wallet}</span> : <span>Winner #{idx + 1}</span>}{" "}
                        {tx && (
                          <>
                            {" • "}
                            <a
                              href={`https://solscan.io/tx/${tx}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-blue-400"
                            >
                              View on Solscan
                            </a>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Optional: jackpot winner (single field fallback) */}
            <div className="mt-4">
              <div className="font-semibold">Winner</div>
              <div className="break-all">
                {draw?.rolled_over ? "None (Rolled Over)" : draw?.winner || "—"}
              </div>
            </div>

            {draw?.tx_signature && (
              <div className="mt-2">
                <a
                  href={`https://solscan.io/tx/${draw.tx_signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-400 break-all"
                >
                  View drawing transaction on Solscan
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
