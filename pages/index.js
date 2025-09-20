import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center justify-start py-10 space-y-8 pt-40">
      {/* Logo */}
      <img
        src="/moonticket-banner.png"
        alt="Moonticket Banner"
        className="w-72 md:w-[28rem] lg:w-[36rem] mx-auto"
      />

      {/* Description */}
      <p className="text-center max-w-2xl px-4 text-lg">
        <strong>Moonticket</strong> is a weekly crypto lotto powered by TIX.
        <br /><br />
        <strong>How it works:</strong> Every <b>$1 of TIX</b> you buy on the <b>Buy TIX</b> page
        gives you <b>1 Moonticket</b> (jackpot entry). You can also claim <b>1 free entry each week</b>.
        Picks are <b>4 numbers (1–25)</b> plus a <b>Moonball (1–10)</b>. <b>You can pick your own numbers or use Quick Pick to auto-generate them.</b>
        <br /><br />
        <strong>Payouts:</strong> The <b>Jackpot</b> pays out <b>80% of the treasury SOL</b> at draw time
        (split evenly among jackpot winners). The remaining <b>20%</b> goes to the Ops wallet.
        Secondary prizes are paid instantly in <b>TIX</b>.
        <br /><br />
        <strong>All entries reset each week</strong> — participate weekly to stay eligible!
      </p>

      {/* Prize Chart */}
      <div className="w-full max-w-3xl px-4">
        <h2 className="text-2xl font-bold text-yellow-300 mb-3 text-center">Prize Chart</h2>
        <div className="overflow-hidden rounded-lg border border-yellow-300/30">
          <table className="w-full text-sm">
            <thead className="bg-yellow-300/10">
              <tr>
                <th className="px-4 py-3 text-left">Tier</th>
                <th className="px-4 py-3 text-left">Match Requirement</th>
                <th className="px-4 py-3 text-right">Prize</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-300/10">
              <tr className="hover:bg-yellow-300/5">
                <td className="px-4 py-3 font-semibold">Jackpot</td>
                <td className="px-4 py-3">4 numbers + Moonball</td>
                <td className="px-4 py-3 text-right">Jackpot (SOL)</td>
              </tr>
              <tr className="hover:bg-yellow-300/5">
                <td className="px-4 py-3 font-semibold">4</td>
                <td className="px-4 py-3">4 numbers</td>
                <td className="px-4 py-3 text-right">250,000 TIX</td>
              </tr>
              <tr className="hover:bg-yellow-300/5">
                <td className="px-4 py-3 font-semibold">3+MB</td>
                <td className="px-4 py-3">3 numbers + Moonball</td>
                <td className="px-4 py-3 text-right">100,000 TIX</td>
              </tr>
              <tr className="hover:bg-yellow-300/5">
                <td className="px-4 py-3 font-semibold">3</td>
                <td className="px-4 py-3">3 numbers</td>
                <td className="px-4 py-3 text-right">50,000 TIX</td>
              </tr>
              <tr className="hover:bg-yellow-300/5">
                <td className="px-4 py-3 font-semibold">2+MB</td>
                <td className="px-4 py-3">2 numbers + Moonball</td>
                <td className="px-4 py-3 text-right">20,000 TIX</td>
              </tr>
              <tr className="hover:bg-yellow-300/5">
                <td className="px-4 py-3 font-semibold">1+MB</td>
                <td className="px-4 py-3">1 number + Moonball</td>
                <td className="px-4 py-3 text-right">15,000 TIX</td>
              </tr>
              <tr className="hover:bg-yellow-300/5">
                <td className="px-4 py-3 font-semibold">0+MB</td>
                <td className="px-4 py-3">Moonball only</td>
                <td className="px-4 py-3 text-right">10,000 TIX</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-yellow-200/80 text-center">
        </p>
      </div>

      {/* Single Moontickets button */}
      <div className="flex justify-center mt-10">
        <Link href="/Moontickets">
          <img
            src="/getMoontickets-button.png"
            alt="Get Moontickets"
            className="w-48 md:w-56 lg:w-64 mx-auto block cursor-pointer"
          />
        </Link>
      </div>
    </div>
  );
}
