import dynamic from "next/dynamic";
require("@solana/wallet-adapter-react-ui/styles.css");

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const WalletConnect = () => {
  return (
    <div className="my-2">
      <WalletMultiButton className="bg-yellow-400 text-black font-semibold px-4 py-2 rounded hover:bg-yellow-300 transition" />
    </div>
  );
};

export default WalletConnect;
