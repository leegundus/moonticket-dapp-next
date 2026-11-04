import Link from "next/link";

const TIX_MINT = "8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek";

export default function DrawingDetails() {
  return (
    <div className="bg-black text-yellow-400 min-h-screen p-5 sm:p-8 pt-40">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-10">About MoonTicket &amp; TIX</h1>

        <section className="space-y-4 text-lg">
          <h2 className="text-2xl font-semibold">What Is MoonTicket?</h2>
          <p>
            MoonTicket is a Solana-based weekly prize drawing platform. Eligible participants
            can claim one free entry per weekly drawing, and one winner is selected each week.
            Prizes may include TIX, SOL, NFTs, or other clearly identified crypto assets.
          </p>
        </section>

        <section className="space-y-4 text-lg mt-10">
          <h2 className="text-2xl font-semibold">What Is TIX?</h2>
          <p>
            TIX is MoonTicket&apos;s token on the Solana blockchain. It can be traded through
            supported Solana exchanges when liquidity is available and may be included in
            MoonTicket weekly prize bundles alongside SOL, NFTs, and other crypto assets.
          </p>
          <p>
            TIX is not required to enter or win a drawing. Buying, owning, or holding TIX
            does not provide extra entries or better winning odds. Token prices can fluctuate
            and trading may involve fees and liquidity risks.
          </p>
          <p className="text-sm break-all">
            <strong>TIX mint address:</strong> {TIX_MINT}
          </p>
          <div className="flex flex-wrap gap-4 text-base">
            <Link href="/buytix" className="underline font-semibold">Buy TIX through Jupiter</Link>
            <a href={`https://solscan.io/token/${TIX_MINT}`} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
              View TIX on Solscan
            </a>
          </div>
        </section>

        <section className="space-y-4 text-lg mt-10">
          <h2 className="text-2xl font-semibold">Free Weekly Entry</h2>
          <p>
            Eligible participants can claim one free entry for each weekly MoonTicket drawing.
            No purchase is necessary to enter or win.
          </p>
          <p>
            Buying or holding TIX does not create additional entries or improve drawing odds.
          </p>
        </section>

        <section className="space-y-4 text-lg mt-10">
          <h2 className="text-2xl font-semibold">Daily TIX Streak</h2>
          <p>
            Connected wallets can check in once per Central Time calendar day to earn gasless
            TIX rewards. The reward increases with each consecutive day: 100, 200, 300, 400,
            500, 750, and 1,000 TIX on Days 1 through 7.
          </p>
          <p>
            After Day 7, a continuous streak keeps earning 1,000 TIX per daily check-in.
            Missing a day resets the next check-in to Day 1. Check-ins do not create a Solana
            transaction, do not charge gas, and do not change weekly drawing odds.
          </p>
          <p>
            Daily rewards are recorded in the MoonTicket rewards ledger and accumulate for a
            future on-chain payout. Rewards are subject to anti-abuse review.
          </p>
          <Link href="/checkin" className="underline font-semibold">Open Daily Check-In</Link>
        </section>

        <section className="space-y-4 text-lg mt-10">
          <h2 className="text-2xl font-semibold">Drawing Schedule</h2>
          <p>
            The weekly drawing is scheduled for Monday at 10:00 PM Central Time. Entries for
            that drawing close at the cutoff, and one eligible entry is selected as the winner.
          </p>
        </section>

        <section className="space-y-4 text-lg mt-10">
          <h2 className="text-2xl font-semibold">Prize</h2>
          <p>
            The current week&apos;s prize is displayed on the Weekly Draw page. MoonTicket may
            offer SOL, TIX, an NFT, or another clearly identified prize package for a drawing.
          </p>
        </section>

        <section className="space-y-4 text-lg mt-10">
          <h2 className="text-2xl font-semibold">Transparency</h2>
          <p>
            Past winners are published on MoonTicket. When a prize is transferred on-chain,
            the payout transaction can be linked so it can be independently verified.
          </p>
        </section>

        <section className="mt-12 border border-yellow-400/30 rounded-xl p-5 text-sm">
          MoonTicket is currently being prepared for public relaunch. Final eligibility,
          anti-abuse controls, and official rules will be published before the first public
          drawing. Void where prohibited.
        </section>
      </div>
    </div>
  );
}
