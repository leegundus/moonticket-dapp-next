import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

require("@solana/wallet-adapter-react-ui/styles.css");

const endpoint = process.env.NEXT_PUBLIC_RPC_URL;

// ✅ Simple mobile check
const isMobile = typeof window !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);

const dynamicWalletProvider = (component) => {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={[new PhantomWalletAdapter()]}
        autoConnect
        onError={(err) => {
          // ✅ Suppress Phantom install error only on mobile
          if (isMobile && err?.message?.includes("Phantom")) return;
          console.error("Wallet error:", err);
        }}
      >
        <WalletModalProvider>
          {component}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default dynamicWalletProvider;
