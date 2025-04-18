import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

require("@solana/wallet-adapter-react-ui/styles.css");

const endpoint = "https://api.mainnet-beta.solana.com";

const dynamicWalletProvider = (component) => {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[new PhantomWalletAdapter()]} autoConnect>
        <WalletModalProvider>
          {component}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default dynamicWalletProvider;
