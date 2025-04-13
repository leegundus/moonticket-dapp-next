import Link from "next/link";
import WalletConnect from "./WalletConnect";
import { useState, useEffect } from "react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "auto";
  }, [isOpen]);

  return (
    <>
      {/* Top Navbar */}
      <nav className="fixed top-0 left-0 right-0 w-full bg-black text-yellow-400 px-6 py-4 flex items-center justify-between border-b border-yellow-400 z-50">
        {/* Logo */}
        <div className="w-32">
          <Link href="/">
            <img src="/moonticket-logo.png" alt="Moonticket Logo" className="w-full h-auto" />
          </Link>
        </div>

        {/* Desktop Nav */}
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

        {/* Wallet + Hamburger */}
        <div className="flex items-center space-x-4">
          <WalletConnect />
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="focus:outline-none z-50 relative">
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
      </nav>

      {/* Spacer below navbar (only when menu is closed) */}
      {!isOpen && <div className="h-20 md:h-24" />}

      {/* Dropdown Overlay - Mobile Only */}
      {isOpen && (
        <div className="fixed inset-0 top-0 bg-black/90 backdrop-blur-sm text-yellow-400 flex flex-col items-center justify-center space-y-6 z-40 md:hidden pt-32">
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
    </>
  );
};

export default Navbar;
