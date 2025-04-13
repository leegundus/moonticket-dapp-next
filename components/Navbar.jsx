import Link from "next/link";
import WalletConnect from "./WalletConnect";
import { useState } from "react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="bg-black text-yellow-400 px-6 py-4 flex items-center justify-between border-b border-yellow-400 relative">
      {/* Hamburger - Mobile Left */}
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

      {/* Logo - Center on Mobile, Left on Desktop */}
      <div className="absolute left-1/2 transform -translate-x-1/2 md:static md:transform-none md:left-auto md:translate-x-0 w-32">
        <Link href="/">
          <img src="/moonticket-logo.png" alt="Moonticket Logo" className="w-full h-auto" />
        </Link>
      </div>

      {/* Links - Desktop */}
      <div className="hidden md:flex space-x-6 ml-4">
        <Link href="/">Home</Link>
        <Link href="/jackpot">Jackpot</Link>
        <Link href="/buytix">Buy $TIX</Link>
        <Link href="/past">Winners</Link>
        <Link href="/nfts">NFTs</Link>
        <Link href="/burn">Burn to Earn</Link>
        <Link href="/staking">Staking</Link>
        <Link href="/whitepaper">Whitepaper</Link>
      </div>

      {/* WalletConnect - Right side always */}
      <div className="ml-auto md:ml-4">
        <WalletConnect />
      </div>

      {/* Dropdown - Mobile */}
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
