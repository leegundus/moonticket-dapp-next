import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
require("@solana/wallet-adapter-react-ui/styles.css");

const endpoint = "https://mainnet.helius-rpc.com/?api-key=47d9c64e-1d5a-4623-abaf-ee532aca9eaa";

const WalletWrapper = ({ children }) => {
  const isPhantomInstalled =
    typeof window !== "undefined" && window.solana?.isPhantom;

  const wallets = isPhantomInstalled ? [new PhantomWalletAdapter()] : [];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletProvider;
