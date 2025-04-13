import { useState } from "react";
import Link from "next/link";
import WalletConnect from "./WalletConnect";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <nav className="bg-black text-yellow-400 px-6 py-4 border-b border-yellow-400">
      <div className="flex justify-between items-center">
        {/* Logo */}
        <div className="w-32">
          <Link href="/">
            <img src="/moonticket-logo.png" alt="Moonticket Logo" className="w-full h-auto" />
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button onClick={toggleMenu} className="text-yellow-400 focus:outline-none text-2xl">
            {isOpen ? "✕" : "☰"}
          </button>
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

        <div className="hidden md:block">
          <WalletConnect />
        </div>
      </div>

      {/* Mobile Dropdown */}
      {isOpen && (
        <div className="md:hidden mt-4 space-y-3 text-center">
          <Link href="/" onClick={() => setIsOpen(false)}>Home</Link>
          <Link href="/jackpot" onClick={() => setIsOpen(false)}>Jackpot</Link>
          <Link href="/buytix" onClick={() => setIsOpen(false)}>Buy $TIX</Link>
          <Link href="/past" onClick={() => setIsOpen(false)}>Winners</Link>
          <Link href="/nfts" onClick={() => setIsOpen(false)}>NFTs</Link>
          <Link href="/burn" onClick={() => setIsOpen(false)}>Burn to Earn</Link>
          <Link href="/staking" onClick={() => setIsOpen(false)}>Staking</Link>
          <Link href="/whitepaper" onClick={() => setIsOpen(false)}>Whitepaper</Link>
          <div className="pt-2">
            <WalletConnect />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
