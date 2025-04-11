export default function Home() {
  return (
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center justify-start py-10 space-y-8">
      {/* Logo */}
      <img
        src="/moonticket-banner.png"
        alt="Moonticket Banner"
        className="w-72 md:w-[28rem] lg:w-[36rem] mx-auto"
      />

      {/* Description */}
      <p className="text-center max-w-2xl px-4 text-lg">
        Moonticket is the ultimate weekly crypto lottery! Buy $TIX to earn entries — every $1 spent through the DApp equals one entry.
        Drawings happen every Monday at 10pm CT. The more people buy, the bigger the jackpot! And even if you don’t win, you still hold $TIX with long-term potential.
      </p>

      {/* Buttons */}
      <div className="flex flex-col items-center space-y-2 mt-4">
        <a href="/jackpot">
          <img src="/jackpot-button.png" alt="Jackpot" className="w-40 md:w-48 mx-auto block" />
        </a>
        <a href="/buytix">
          <img src="/buyTix-button.png" alt="Buy TIX" className="w-40 md:w-48 mx-auto block" />
        </a>
        <a href="/pastdrawings">
          <img src="/past-button.png" alt="Past Drawings" className="w-40 md:w-48 mx-auto block" />
        </a>
        <a href="/nfts">
          <img src="/nfts-button.png" alt="NFTs" className="w-40 md:w-48 mx-auto block" />
        </a>
        <a href="/burn">
          <img src="/burn-button.png" alt="Burn to Earn" className="w-40 md:w-48 mx-auto block" />
        </a>
        <a href="/staking">
          <img src="/staking-button.png" alt="Staking" className="w-40 md:w-48 mx-auto block" />
        </a>
        <a href="/whitepaper">
          <img src="/whitepaper-button.png" alt="Whitepaper" className="w-40 md:w-48 mx-auto block" />
        </a>
      </div>
    </div>
  );
}
