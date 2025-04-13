import Link from "next/link";
import WalletConnect from "./WalletConnect";

const Navbar = () => {
  return (
    <nav className="bg-black text-yellow-400 px-6 py-4 flex justify-between items-center border-b border-yellow-400">
      {/* Logo */}
      <div className="w-32">
        <Link href="/">
          <img src="/moonticket-logo.png" alt="Moonticket Logo" className="w-full h-auto" />
        </Link>
      </div>

      <div className="space-x-6">
        <Link href="/">Home</Link>
        <Link href="/jackpot">Jackpot</Link>
        <Link href="/buytix">Buy $TIX</Link>
        <Link href="/past">Winners</Link>
        <Link href="/nfts">NFTs</Link>
        <Link href="/burn">Burn to Earn</Link>
        <Link href="/staking">Staking</Link>
        <Link href="/whitepaper">Whitepaper</Link>
      </div>

      <WalletConnect />
    </nav>
  );
};

export default Navbar;
