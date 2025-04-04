export default function Home() {
  return (
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center justify-start py-10 space-y-8">
      <h1 className="text-4xl font-bold">Tailwind is working!</h1>

      {/* Logo */}
      <img
        src="/moonticket-logo.png"
        alt="Moonticket Logo"
        className="w-40 md:w-72 mx-auto block"
      />

      {/* Buttons */}
      <div className="flex flex-col items-center space-y-2 mt-8">
        <a href="/jackpot">
          <img src="/jackpot-button.png" alt="Jackpot" className="w-40 md:w-48 mx-auto block" />
        </a>
        <a href="/buytix">
          <img src="/buyTix-button.png" alt="Buy TIX" className="w-40 md:w-48 mx-auto block" />
        </a>
        <a href="/nfts">
          <img src="/nfts-button.png" alt="NFTs" className="w-40 md:w-48 mx-auto block" />
        </a>
        <a href="/whitepaper">
          <img src="/whitepaper-button.png" alt="Whitepaper" className="w-40 md:w-48 mx-auto block" />
        </a>
      </div>
    </div>
  )
}
