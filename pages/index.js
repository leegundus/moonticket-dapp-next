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
        Moonticket is a weekly crypto prize draw powered by $TIX. Every $1 spent through the DApp earns one entry into the next jackpot. You can also claim <strong>one free entry per week</strong> by tweeting about Moonticket.
        <br /><br />
        <strong>All entries reset each week</strong> — so participate weekly to stay eligible!
        <br /><br />
        The more people buy, the bigger the prize — and even if you don’t win, you still hold $TIX, which may have long-term potential once trading begins on a DEX.
        <br /><br />
        To claim your free entry, click the <strong>FREE TIX</strong> button on the Jackpot page.
      </p>

      {/* Buttons */}
      <div className="flex flex-col items-center space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <button onClick={() => window.location.href = "/jackpot"}>
            <img src="/jackpot-button.png" alt="Jackpot" className="w-40 md:w-48 mx-auto block cursor-pointer" />
          </button>
          <button onClick={() => window.location.href = "/buytix"}>
            <img src="/buyTix-button.png" alt="Buy TIX" className="w-40 md:w-48 mx-auto block cursor-pointer" />
          </button>
          <Link href="/past">
            <img src="/past-button.png" alt="Winners" className="w-40 md:w-48 mx-auto block cursor-pointer" />
          </Link>
          <Link href="/nfts">
            <img src="/nfts-button.png" alt="NFTs" className="w-40 md:w-48 mx-auto block cursor-pointer" />
          </Link>
          <Link href="/burn">
            <img src="/burn-button.png" alt="Burn to Earn" className="w-40 md:w-48 mx-auto block cursor-pointer" />
          </Link>
          <Link href="/staking">
            <img src="/staking-button.png" alt="Staking" className="w-40 md:w-48 mx-auto block cursor-pointer" />
          </Link>
        </div>

        <Link href="/whitepaper">
          <img src="/whitepaper-button.png" alt="Whitepaper" className="w-40 md:w-48 mx-auto block cursor-pointer" />
        </Link>
      </div>
    </div>
  );
}
