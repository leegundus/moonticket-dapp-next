import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center justify-start py-10 pt-40 px-4">
      <img
        src="/moonticket-banner.png"
        alt="MoonTicket"
        className="w-72 md:w-[28rem] lg:w-[36rem] mx-auto"
      />

      <div className="max-w-3xl text-center mt-8">
        <h1 className="text-3xl md:text-4xl font-bold">One Free Entry. One Winner. Every Week.</h1>
        <p className="text-lg mt-5 leading-relaxed">
          MoonTicket is a weekly SOL prize drawing on Solana. Connect your wallet, claim your
          free weekly entry, and come back for the Monday night drawing.
        </p>
        <p className="text-lg mt-4 font-semibold">No purchase necessary.</p>
        <p className="mt-2">
          Buying or holding TIX does not increase your chance of winning.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mt-10">
        <Link
          href="/Moontickets"
          className="bg-yellow-400 text-black font-bold rounded-lg px-6 py-3 text-center"
        >
          Enter This Week's Drawing
        </Link>
        <Link
          href="/past"
          className="border border-yellow-400 font-bold rounded-lg px-6 py-3 text-center"
        >
          Past Winners
        </Link>
      </div>

      <div className="max-w-3xl mt-12 border border-yellow-400/30 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-center">Where TIX Fits</h2>
        <p className="mt-4 leading-relaxed text-center">
          TIX remains the MoonTicket ecosystem token. The V2 relaunch will reconnect TIX to real
          Solana market trading, liquidity, sponsorships, and jackpot funding without requiring
          TIX ownership for entry.
        </p>
        <p className="mt-4 text-center text-sm">
          TIX Mint: 8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek
        </p>
        <div className="text-center mt-5">
          <Link href="/whitepaper" className="underline font-semibold">Read the V2 overview</Link>
        </div>
      </div>
    </div>
  );
}
