import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

require("@solana/wallet-adapter-react-ui/styles.css");

const endpoint = "https://api.devnet.solana.com";
const wallets = [new PhantomWalletAdapter()];

const dynamicWalletProvider = (component) => {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{component}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default dynamicWalletProvider;
