import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import dynamic from "next/dynamic";

require("@solana/wallet-adapter-react-ui/styles.css");

const endpoint = process.env.NEXT_PUBLIC_RPC_URL;

const isPhantomInstalled =
  typeof window !== "undefined" &&
  window?.solana?.isPhantom &&
  window?.solana?.isConnected !== undefined;

const dynamicWalletProvider = (component) => {
  if (!isPhantomInstalled) {
    // Don't render wallet providers if Phantom is not installed
    return (
      <div className="text-center text-white pt-40">
        <p>Phantom Wallet not detected.</p>
        <a
          href="https://phantom.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow-400 underline"
        >
          Install Phantom to use Moonticket
        </a>
      </div>
    );
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[new PhantomWalletAdapter()]} autoConnect>
        <WalletModalProvider>{component}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default dynamicWalletProvider;
