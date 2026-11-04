import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import MoonTicketBanner from "../components/MoonTicketBanner";
import { DAILY_TIX_REWARDS } from "../lib/dailyStreak";

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

export default function DailyCheckIn() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    if (!wallet) {
      setStatus(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkinStatus?wallet=" + encodeURIComponent(wallet));
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not load streak.");
      setStatus(data);
    } catch (err) {
      setMessage(err?.message || "Could not load streak.");
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function checkIn() {
    if (!wallet) {
      setMessage("Connect your Solana wallet first.");
      return;
    }

    setCheckingIn(true);
    setMessage("");
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Check-in failed.");

      if (data.alreadyCheckedIn) {
        setMessage("You're already checked in for today.");
      } else {
        setMessage(`Checked in! +${formatNumber(data.rewardTix)} TIX added to your rewards balance.`);
      }
      await loadStatus();
    } catch (err) {
      setMessage(err?.message || "Check-in failed.");
    } finally {
      setCheckingIn(false);
    }
  }

  const streak = Number(status?.streak || 0);

  return (
    <div className="min-h-screen bg-black text-yellow-400 pt-36 pb-20 px-4">
      <main className="max-w-4xl mx-auto">
        <MoonTicketBanner className="mb-4" />

        <div className="text-center mt-4">
          <h1 className="text-3xl md:text-4xl font-bold">Daily Streak Check-In</h1>
          <p className="mt-3 text-yellow-100/90">
            Check in every day to build your streak and earn more TIX.
            Miss a Central Time calendar day and your streak resets to Day 1.
          </p>
        </div>

        <section className="mt-8 border border-yellow-400/40 rounded-2xl p-5 md:p-7">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="rounded-xl border border-yellow-400/20 p-4">
              <div className="text-xs uppercase opacity-70">Current Streak</div>
              <div className="text-2xl font-bold mt-1">{streak}/7</div>
            </div>
            <div className="rounded-xl border border-yellow-400/20 p-4">
              <div className="text-xs uppercase opacity-70">Next Reward</div>
              <div className="text-2xl font-bold mt-1">{formatNumber(status?.nextRewardTix || 100)} TIX</div>
            </div>
            <div className="rounded-xl border border-yellow-400/20 p-4">
              <div className="text-xs uppercase opacity-70">Rewards Balance</div>
              <div className="text-2xl font-bold mt-1">{formatNumber(status?.pendingTix || 0)} TIX</div>
            </div>
            <div className="rounded-xl border border-yellow-400/20 p-4">
              <div className="text-xs uppercase opacity-70">Lifetime Earned</div>
              <div className="text-2xl font-bold mt-1">{formatNumber(status?.lifetimeTix || 0)} TIX</div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mt-8">
            {DAILY_TIX_REWARDS.map((reward, index) => {
              const day = index + 1;
              const complete = day <= streak;
              const next = !status?.checkedInToday && day === Number(status?.nextStreakDay || 1);

              return (
                <div
                  key={day}
                  className={[
                    "rounded-xl border px-1 py-3 text-center",
                    complete ? "border-green-400/70 bg-green-400/10" : "border-yellow-400/25",
                    next ? "ring-2 ring-yellow-400" : "",
                  ].join(" ")}
                >
                  <div className="text-xs md:text-sm font-semibold">Day {day}</div>
                  <div className="mt-2 text-[10px] md:text-xs">{formatNumber(reward)}</div>
                  <div className="text-[9px] md:text-[10px] opacity-70">TIX</div>
                  {complete && <div className="mt-1 text-green-400">✓</div>}
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            {!publicKey ? (
              <p className="font-semibold">Connect your wallet to start your streak.</p>
            ) : loading ? (
              <p>Loading your streak…</p>
            ) : status?.checkedInToday ? (
              <div>
                <div className="text-green-400 text-xl font-bold">✓ Checked in today</div>
                <p className="mt-2 text-sm opacity-80">
                  Come back tomorrow to keep your streak going.
                </p>
              </div>
            ) : (
              <button
                onClick={checkIn}
                disabled={checkingIn}
                className="bg-yellow-400 text-black font-bold rounded-lg px-8 py-3 disabled:opacity-50"
              >
                {checkingIn ? "Checking In…" : `Check In Today — +${formatNumber(status?.nextRewardTix || 100)} TIX`}
              </button>
            )}

            {message && <p className="mt-4 text-sm">{message}</p>}
          </div>
        </section>

        <section className="mt-6 text-center text-xs leading-relaxed text-yellow-100/70">
          <p>Daily check-ins are gasless. No Solana transaction is created and no network fee is charged.</p>
          <p className="mt-2">
            TIX rewards accumulate in your MoonTicket rewards balance for a future on-chain payout.
            Daily rewards do not increase weekly drawing odds and are subject to anti-abuse review.
          </p>
          <p className="mt-2">After Day 7, consecutive daily check-ins continue earning 1,000 TIX per day until the streak is broken.</p>
        </section>
      </main>
    </div>
  );
}
