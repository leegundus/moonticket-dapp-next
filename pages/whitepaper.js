export default function Whitepaper() {
  return (
    <div className="bg-black text-yellow-400 min-h-screen p-8 pt-40">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-10">MoonTicket V2 Overview</h1>

        <section className="space-y-4 text-lg">
          <h2 className="text-2xl font-semibold">The Weekly Drawing</h2>
          <p>
            MoonTicket V2 is a weekly promotional SOL prize drawing on Solana. Eligible
            participants can claim one free entry for each weekly drawing. No purchase is
            necessary, and buying or holding TIX does not increase the odds of winning.
          </p>
          <p>
            The V2 target schedule is Monday at 10:00 PM Central Time. One eligible entry is
            selected as the weekly winner, and past winners and payout transactions are published
            for transparency.
          </p>
        </section>

        <section className="space-y-4 text-lg mt-10">
          <h2 className="text-2xl font-semibold">TIX Utility</h2>
          <p>
            TIX remains the MoonTicket ecosystem token. V2 is being designed around real Solana
            market trading and useful ecosystem functions rather than selling extra drawing odds.
          </p>
          <p>
            Planned V2 utility includes market liquidity, jackpot-funding mechanisms tied to
            trading activity, sponsorship integrations, and other MoonTicket ecosystem features.
            These integrations are not yet live in this preview.
          </p>
        </section>

        <section className="space-y-4 text-lg mt-10">
          <h2 className="text-2xl font-semibold">Transparency</h2>
          <p>
            The live prize balance is displayed in the dApp. MoonTicket will publish weekly winner
            records and Solana transaction links so payouts can be independently checked on-chain.
          </p>
        </section>

        <section className="space-y-4 text-lg mt-10">
          <h2 className="text-2xl font-semibold">Token & Contract Information</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Token:</strong> MoonTicket (TIX)</li>
            <li><strong>TIX Mint:</strong> 8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek</li>
            <li><strong>Legacy Jackpot Program:</strong> GmyMFG4QwHh2YK4bjy489eBzf9Hzf3BLZ1sFfznoeWpB</li>
            <li><strong>Network:</strong> Solana mainnet</li>
          </ul>
        </section>

        <section className="mt-12 border border-yellow-400/30 rounded-xl p-5 text-sm">
          <strong>V2 preview notice:</strong> Final eligibility requirements, anti-abuse controls,
          prize mechanics, official rules, and TIX trading integrations will be finalized before
          public relaunch. Void where prohibited.
        </section>
      </div>
    </div>
  );
}
