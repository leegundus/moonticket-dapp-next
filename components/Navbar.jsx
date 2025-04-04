import Link from "next/link";
import WalletConnect from "./WalletConnect";

const Navbar = () => {
  return (
    <nav className="bg-black text-yellow-400 px-6 py-4 flex justify-between items-center border-b border-yellow-400">
      <div className="space-x-6">
        <Link href="/jackpot">Jackpot</Link>
        <Link href="/buytix">Buy $TIX</Link>
        <Link href="/past-drawings">Past Drawings</Link>
      </div>
      <WalletConnect />
    </nav>
  );
};

export default Navbar;
