import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import dynamic from "next/dynamic";

require("@solana/wallet-adapter-react-ui/styles.css");

const endpoint = process.env.NEXT_PUBLIC_RPC_URL;

const dynamicWalletProvider = (component) => {
  // Check for Phantom only on the client side
  const isPhantomAvailable =
    typeof window !== "undefined" &&
    window?.solana &&
    window.solana.isPhantom;

  const wallets = isPhantomAvailable ? [new PhantomWalletAdapter()] : [];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{component}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default dynamicWalletProvider;
