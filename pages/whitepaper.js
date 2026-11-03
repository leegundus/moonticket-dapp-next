export default function DrawingDetails() {
  return (
    <div className="bg-black text-yellow-400 min-h-screen p-8 pt-40">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-10">How the Weekly Drawing Works</h1>

        <section className="space-y-4 text-lg">
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
