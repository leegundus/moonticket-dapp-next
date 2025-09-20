import { useEffect, useMemo, useState } from "react";

/* ---------------- Winning numbers (image chips) ---------------- */
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

/* ---------------- Tier list (display order) ---------------- */
const TIERS = [
  { key: "jackpot", label: "Jackpot", rule: "4 numbers + Moonball" },
  { key: "4",       label: "4",       rule: "4 numbers" },
  { key: "3+MB",    label: "3+MB",    rule: "3 numbers + Moonball" },
  { key: "3",       label: "3",       rule: "3 numbers" },
  { key: "2+MB",    label: "2+MB",    rule: "2 numbers + Moonball" },
  { key: "1+MB",    label: "1+MB",    rule: "1 number + Moonball" },
  { key: "0+MB",    label: "0+MB",    rule: "Moonball only" },
];

/* ---------------- Helpers ---------------- */
const norm = (v) => String(v ?? "").trim().toUpperCase();

function mapAwardToTierKey(a = {}) {
  // Primary: trust the text in the "tier" column
  const t = norm(a.tier ?? a.tier_name ?? a.level);
  if (t === "JACKPOT") return "jackpot";
  if (["4", "3+MB", "3", "2+MB", "1+MB", "0+MB"].includes(t)) return t;

  // Fallback inference from matches + moonball flags if needed
  const m = Number(a.matches ?? a.match_count ?? a.num_matches ?? 0);
  const mb = Boolean(a.moonball_mat ?? a.moonball ?? a.mb ?? a.moonball_match);
  if (m === 4 && mb) return "jackpot";
  if (m === 4) return "4";
  if (m === 3 && mb) return "3+MB";
  if (m === 3) return "3";
  if (m === 2 && mb) return "2+MB";
  if (m === 1 && mb) return "1+MB";
  if (m === 0 && mb) return "0+MB";
  return null;
}

function countsFromAwards(awards = []) {
  const counts = { jackpot: 0, "4": 0, "3+MB": 0, "3": 0, "2+MB": 0, "1+MB": 0, "0+MB": 0 };
  for (const a of awards) {
    const k = mapAwardToTierKey(a);
    if (k) counts[k] += 1;
  }
  return counts;
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

/* ---------------- Page ---------------- */
export default function PastDrawings() {
  const [draws, setDraws] = useState([]);
  const [i, setI] = useState(0);
  const draw = useMemo(() => (draws.length ? draws[i] : null), [draws, i]);

  // raw awards for the currently selected draw (from prize_awards table)
  const [awards, setAwards] = useState([]);
  const awardCounts = useMemo(() => countsFromAwards(awards), [awards]);

  // Load draw list
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

  // Load awards *for the selected draw* directly from the prize_awards table API
  useEffect(() => {
    if (!draw?.id) {
      setAwards([]);
      return;
    }
    (async () => {
      try {
        // IMPORTANT: This endpoint must return rows from public.prize_awards for the given draw_id.
        // Example shape we expect per row: { draw_id, wallet, tier, matches, moonball_mat, tx_sig, ... }
        const res = await fetch(`/api/prizeAwards?drawId=${encodeURIComponent(draw.id)}`);
        const data = await res.json();
        setAwards(Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []);
      } catch {
        setAwards([]);
      }
    })();
  }, [draw?.id]);

  const { nums, moonball } = readWinningNums(draw || {});
  const treasurySol = Number(draw?.jackpot_sol || 0); // treasury snapshot
  const dt = draw?.draw_date ? new Date(draw.draw_date) : null;

  // Jackpot totals: count strictly by "JACKPOT" rows in prize_awards
  const jackpotWinners = awardCounts.jackpot;
  // If you store explicit payout pool use it, else take 80% of treasury:
  const totalJackpotSol =
    Number(draw?.jackpot_payout_sol ?? draw?.jackpot_sol_payout) ||
    (treasurySol > 0 ? treasurySol * 0.8 : 0);
  const perWinnerSol = jackpotWinners > 0 && totalJackpotSol > 0
    ? totalJackpotSol / jackpotWinners
    : 0;

  // Jackpot payout txs (if prize_awards rows include tx_sig)
  const jackpotAwards = awards.filter((a) => mapAwardToTierKey(a) === "jackpot");

  // keyboard arrow nav
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      if (e.key === "ArrowRight") setI((x) => Math.min(draws.length - 1, x + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draws.length]);

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

            {/* Jackpot overview */}
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

            {/* Tier breakdown (counts come ONLY from prize_awards) */}
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
                      <td className="px-3 py-2 text-right">{awardCounts[t.key] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Jackpot payout transactions */}
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

            {/* Single winner fallback (legacy field) */}
            <div className="mt-4">
              <div className="font-semibold">Winner</div>
              <div className="break-all">
                {draw?.rolled_over ? "None (Rolled Over)" : draw?.winner || "—"}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
