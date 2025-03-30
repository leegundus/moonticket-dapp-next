import dynamic from "next/dynamic";
require("@solana/wallet-adapter-react-ui/styles.css");

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const WalletConnect = () => {
  return (
    <div style={{ margin: "1rem 0" }}>
      <WalletMultiButton />
    </div>
  );
};

export default WalletConnect;
