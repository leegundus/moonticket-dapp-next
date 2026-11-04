import Link from "next/link";
import MoonTicketBanner from "../components/MoonTicketBanner";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center justify-start py-10 pt-40 px-4">
      <MoonTicketBanner />

      <div className="max-w-3xl text-center mt-8">
        <h1 className="text-3xl md:text-4xl font-bold">One Free Entry. One Winner. Every Week.</h1>
        <p className="text-lg mt-5 leading-relaxed">
          MoonTicket is a weekly prize drawing on Solana. Connect your Solana wallet,
          claim one free entry, and come back for the Monday night drawing.
        </p>
        <p className="text-lg mt-4 font-semibold">No purchase necessary.</p>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 mt-10">
        <Link
          href="/Moontickets"
          className="bg-yellow-400 text-black font-bold rounded-lg px-6 py-3 text-center"
        >
          Enter This Week&apos;s Drawing
        </Link>
        <Link
          href="/checkin"
          className="border border-yellow-400 font-bold rounded-lg px-6 py-3 text-center"
        >
          Daily TIX Check-In
        </Link>
        <Link
          href="/past"
          className="border border-yellow-400 font-bold rounded-lg px-6 py-3 text-center"
        >
          Past Winners
        </Link>
      </div>

      <div className="max-w-3xl mt-12 border border-yellow-400/30 rounded-xl p-6 text-center">
        <h2 className="text-2xl font-bold">How It Works</h2>
        <p className="mt-4 leading-relaxed">
          Each eligible wallet can claim one free entry per weekly drawing. Entries close
          for the drawing at Monday 10:00 PM Central Time. One winner is selected and the
          result and payout information are published for transparency.
        </p>
        <p className="mt-4 leading-relaxed">
          You can also check in once each day to build a 7-day streak and earn TIX rewards.
          Daily TIX rewards do not change your weekly drawing odds.
        </p>
        <div className="mt-5">
          <Link href="/whitepaper" className="underline font-semibold">See drawing details</Link>
        </div>
      </div>
    </div>
  );
}
