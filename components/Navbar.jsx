import Link from "next/link";
import WalletConnect from "./WalletConnect";
import { useState } from "react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-black text-yellow-400 px-6 py-4 flex items-center justify-between border-b border-yellow-400 relative">
      {/* Logo - Left */}
      <div className="w-32">
        <Link href="/">
          <img src="/moonticket-logo.png" alt="Moonticket Logo" className="w-full h-auto" />
        </Link>
      </div>

      {/* Desktop Links */}
      <div className="hidden md:flex space-x-6">
        <Link href="/">Home</Link>
        <Link href="/jackpot">Jackpot</Link>
        <Link href="/buytix">Buy $TIX</Link>
        <Link href="/past">Winners</Link>
        <Link href="/nfts">NFTs</Link>
        <Link href="/burn">Burn to Earn</Link>
        <Link href="/staking">Staking</Link>
        <Link href="/whitepaper">Whitepaper</Link>
      </div>

      {/* Right Side: Wallet + Hamburger */}
      <div className="flex items-center space-x-4">
        <WalletConnect />

        {/* Hamburger (Mobile Only) */}
        <div className="md:hidden">
          <button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none">
            <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Dropdown - Mobile Only */}
      {isOpen && (
        <div className="absolute top-20 left-0 right-0 bg-black border-t border-yellow-400 flex flex-col items-center space-y-4 py-4 md:hidden z-50">
          <Link href="/" onClick={() => setIsOpen(false)}>Home</Link>
          <Link href="/jackpot" onClick={() => setIsOpen(false)}>Jackpot</Link>
          <Link href="/buytix" onClick={() => setIsOpen(false)}>Buy $TIX</Link>
          <Link href="/past" onClick={() => setIsOpen(false)}>Winners</Link>
          <Link href="/nfts" onClick={() => setIsOpen(false)}>NFTs</Link>
          <Link href="/burn" onClick={() => setIsOpen(false)}>Burn to Earn</Link>
          <Link href="/staking" onClick={() => setIsOpen(false)}>Staking</Link>
          <Link href="/whitepaper" onClick={() => setIsOpen(false)}>Whitepaper</Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
