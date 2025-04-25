import {
  ConnectionProvider,
  WalletProvider
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { useMemo } from "react";
require("@solana/wallet-adapter-react-ui/styles.css");

const endpoint = "https://mainnet.helius-rpc.com/?api-key=your-api-key";

const DynamicWalletProvider = ({ children }) => {
  const wallets = useMemo(() => {
    if (typeof window !== "undefined" && window.solana?.isPhantom) {
      return [new PhantomWalletAdapter()];
    }
    return [];
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default DynamicWalletProvider;
