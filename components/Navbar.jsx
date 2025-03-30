import Link from "next/link";
import WalletConnect from "./WalletConnect";

const Navbar = () => {
  return (
    <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", borderBottom: "1px solid #ccc" }}>
      <div>
        <Link href="/jackpot" style={{ marginRight: "20px" }}>Jackpot</Link>
        <Link href="/buytix">Buy $TIX</Link>
      </div>
      <WalletConnect />
    </nav>
  );
};

export default Navbar;
