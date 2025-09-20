import { useEffect, useMemo, useState } from "react";

// canonical tier ordering + labels used for display
const TIER_ORDER = [
  "jackpot",
  "four",
  "three_mb",
  "three",
  "two_mb",
  "one_mb",
  "zero_mb",
];
const TIER_LABELS = {
  jackpot: "Jackpot",
  four: "4",
  three_mb: "3+MB",
  three: "3",
  two_mb: "2+MB",
  one_mb: "1+MB",
  zero_mb: "0+MB",
};

// normalize various API shapes into one structure:
// [{ code, label, winners: [{wallet, prize_sol, prize_tix}], totals }]
function normalizeTierData(draw) {
  const tiers = [];

  // case A: flat winners array
  if (Array.isArray(draw?.winners)) {
    const grouped = draw.winners.reduce((m, w) => {
      const code = mapTierCode(w.tier);
      if (!code) return m;
      (m[code] = m[code] || []).push(w);
      return m;
    }, {});
    for (const code of TIER_ORDER) {
      const arr = grouped[code] || [];
      tiers.push({
        code,
        label: TIER_LABELS[code],
        winners: arr.map((w) => ({
          wallet: w.wallet || w.address || w.addr || "",
          prize_sol: numOrNull(w.prize_sol),
          prize_tix: intOrNull(w.prize_tix),
        })),
      });
    }
    return tiers;
  }

  // case B: object keyed by tier → array of winners
  const keyed =
    draw?.tierWinners || draw?.tier_winners || draw?.tiers || null;
  if (keyed && typeof keyed === "object") {
    for (const code of TIER_ORDER) {
      const arr = keyed[code] || [];
      const list = Array.isArray(arr) ? arr : [];
      tiers.push({
        code,
        label: TIER_LABELS[code],
        winners: list.map((w) => ({
          wallet: w.wallet || w.address || w.addr || "",
          prize_sol: numOrNull(w.prize_sol),
          prize_tix: intOrNull(w.prize_tix),
        })),
      });
    }
    return tiers;
  }

  // nothing detailed
  return null;
}

function mapTierCode(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase().replace(/\s+/g, "");
  if (["jackpot", "jp"].includes(s)) return "jackpot";
  if (["4", "four"].includes(s)) return "four";
  if (["3+mb", "3mb", "three_mb", "three+mb"].includes(s)) return "three_mb";
  if (["3", "three"].includes(s)) return "three";
  if (["2+mb", "2mb", "two_mb", "two+mb"].includes(s)) return "two_mb";
  if (["1+mb", "1mb", "one_mb", "one+mb"].includes(s)) return "one_mb";
  if (["0+mb", "0mb", "zero_mb", "zero+mb"].includes(s)) return "zero_mb";
  return null;
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function WinningNumbers({ draw }) {
  const wn = draw?.winning_numbers || draw?.winningNumbers;
  if (!wn) return null;
  const nums = [wn.num1, wn.num2, wn.num3, wn.num4].filter((n) => n != null).sort((a, b) => a - b);
  const mb = wn.moonball ?? wn.mb ?? null;
  if (!nums.length && mb == null) return null;

  return (
    <div className="mt-2 text-sm">
      <span className="opacity-80">Winning Numbers:&nbsp;</span>
      <span className="font-semibold">
        {nums.join(" - ")}
        {mb != null ? `  |  MB ${mb}` : ""}
      </span>
    </div>
  );
}

export default function PastDrawings() {
  const [draws, setDraws] = useState([]);

  useEffect(() => {
    const fetchDraws = async () => {
      try {
        const res = await fetch("/api/pastDraws");
        const data = await res.json();
        setDraws(Array.isArray(data) ? data : []);
      } catch {
        setDraws([]);
      }
    };
    fetchDraws();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-black text-yellow-400 overflow-x-hidden">
      <main className="flex-grow px-6 pt-40">
        <h1 className="text-2xl font-bold mb-4">Past Drawings</h1>

        {draws.length === 0 ? (
          <p>No draws yet.</p>
        ) : (
          <ul className="space-y-6">
            {draws.map((draw) => {
              const tiers = normalizeTierData(draw);
              const jackpotPaid = numOrNull(draw?.jackpot_sol);

              return (
                <li
                  key={draw.id || draw.draw_id || draw.tx_signature}
                  className="border p-4 border-yellow-600/70 rounded max-w-full overflow-hidden"
                >
                  <div className="flex flex-col gap-1">
                    <div>
                      <strong>Date:</strong>{" "}
                      {draw?.draw_date ? new Date(draw.draw_date).toLocaleString() : "—"}
                    </div>

                    {typeof jackpotPaid === "number" && (
                      <div>
                        <strong>Jackpot (SOL):</strong>{" "}
                        {jackpotPaid.toFixed(4)}
                      </div>
                    )}

                    {typeof draw?.entries === "number" && (
                      <div>
                        <strong>Entries:</strong> {draw.entries.toLocaleString()}
                      </div>
                    )}

                    <WinningNumbers draw={draw} />

                    {draw?.tx_signature && (
                      <div className="truncate">
                        <strong>Transaction:</strong>{" "}
                        <a
                          href={`https://solscan.io/tx/${draw.tx_signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-blue-400 break-all"
                        >
                          View on Solscan
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Tiered winners */}
                  {tiers ? (
                    <div className="mt-4 overflow-hidden rounded border border-yellow-400/30">
                      <table className="w-full text-sm">
                        <thead className="bg-yellow-300/10">
                          <tr>
                            <th className="px-3 py-2 text-left">Tier</th>
                            <th className="px-3 py-2 text-left">Winners</th>
                            <th className="px-3 py-2 text-right">Prize</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-yellow-300/10">
                          {tiers.map((t) => (
                            <tr key={t.code} className="align-top">
                              <td className="px-3 py-2 font-semibold whitespace-nowrap">
                                {TIER_LABELS[t.code] || t.code}
                              </td>
                              <td className="px-3 py-2">
                                {!t.winners?.length ? (
                                  <span className="opacity-70">—</span>
                                ) : (
                                  <ul className="space-y-1">
                                    {t.winners.map((w, i) => (
                                      <li key={i} className="break-all">
                                        {w.wallet || "—"}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                {!t.winners?.length ? (
                                  <span className="opacity-70">—</span>
                                ) : (
                                  <ul className="space-y-1">
                                    {t.winners.map((w, i) => (
                                      <li key={i}>
                                        {typeof w.prize_sol === "number"
                                          ? `${w.prize_sol.toFixed(6)} SOL`
                                          : typeof w.prize_tix === "number"
                                          ? `${w.prize_tix.toLocaleString()} TIX`
                                          : "—"}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    // Fallback if API doesn't include per-tier detail
                    <div className="mt-3">
                      <p className="break-all">
                        <strong>Winner:</strong>{" "}
                        {draw.rolled_over ? "None (Rolled Over)" : draw.winner || "—"}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
