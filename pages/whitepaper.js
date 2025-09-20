export default function Whitepaper() {
  return (
    <div className="bg-black text-yellow-400 min-h-screen p-8 text-center w-full overflow-x-hidden pt-40">
      <h1 className="text-3xl font-bold mb-10">Moonticket Whitepaper – 2025 Edition</h1>

      {/* Overview */}
      <div className="max-w-3xl mx-auto text-left space-y-4 text-lg">
        <h2 className="text-2xl font-semibold mb-4 text-center mt-12">Overview</h2>
        <p>
          <strong>Moonticket</strong> is a weekly crypto lottery on Solana. Players enter a
          Powerball-style draw by picking <strong>4 numbers (1–25)</strong> plus a{" "}
          <strong>Moonball (1–10)</strong>. You can choose your own numbers or use{" "}
          <strong>Quick Pick</strong>.
        </p>
        <p>
          The jackpot is funded by TIX purchases through the Moonticket dApp. Each week all entries
          reset, and a new drawing occurs on Monday at 10:00 PM CT. Winnings are paid instantly
          (Jackpot in SOL; secondary prizes in TIX).
        </p>
        <p>
          You can also get <strong>1 free Moonticket each week</strong> by posting on X (see the
          Moontickets page for the one-click post link and claim flow).
        </p>
        <p>
          <strong>Trading:</strong> $TIX is listed on Raydium. Liquidity and ongoing activity from
          TIX purchases help power the jackpot.
        </p>
      </div>

      {/* How to Play */}
      <div className="max-w-3xl mx-auto text-left space-y-6 text-lg mt-12">
        <section>
          <h2 className="text-2xl font-semibold text-center mb-4">How to Play</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Buy TIX and/or claim your weekly free Moonticket.</li>
            <li>Create tickets by choosing 4 numbers (1–25) + Moonball (1–10) or use Quick Pick.</li>
            <li>Submit your tickets before the countdown ends.</li>
            <li>After the draw, prizes are awarded automatically.</li>
          </ol>
        </section>

        {/* Prize Chart */}
        <section>
          <h2 className="text-2xl font-semibold text-center mb-4">Prize Chart</h2>
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
        </section>

        {/* Jackpot Payouts */}
        <section>
          <h2 className="text-2xl font-semibold text-center mb-4">Payouts</h2>
          <p>
            The <strong>Jackpot</strong> is paid in SOL and secondary prizes are paid in TIX.
            Payout details and the live jackpot are always visible in the dApp. Winners are
            calculated immediately after the drawing and prizes are distributed automatically.
          </p>
        </section>
      </div>

      {/* Token + Contract Info */}
      <div className="max-w-3xl mx-auto text-left space-y-4 text-lg mt-16 mb-20">
        <h2 className="text-2xl font-semibold text-center mb-4">Token &amp; Contract Info</h2>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Token:</strong> Moonticket ($TIX)</li>
          <li><strong>TIX Mint Address:</strong> 8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek</li>
          <li><strong>Jackpot Smart Contract:</strong> GmyMFG4QwHh2YK4bjy489eBzf9Hzf3BLZ1sFfznoeWpB</li>
          <li><strong>DEX:</strong> Listed on Raydium (Solana mainnet).</li>
        </ul>
      </div>
    </div>
  );
}

