import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
require("@solana/wallet-adapter-react-ui/styles.css");

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const WalletConnect = () => {
  const { wallet } = useWallet();
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    if (wallet && wallet.adapter.name !== "Phantom") {
      alert("Only Phantom Wallet is supported. Please use Phantom.");
    }
  }, [wallet]);

  const handleClick = () => {
    const isPhantomInstalled = window?.phantom?.solana?.isPhantom;
    if (!isPhantomInstalled) {
      setShowInstallModal(true);
    }
  };

  return (
    <div className="my-2">
      <div onClick={handleClick}>
        <WalletMultiButton className="!bg-yellow-400 !text-black !font-semibold !px-4 !py-2 !rounded hover:!bg-yellow-300 transition" />
      </div>

      {showInstallModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white text-black p-6 rounded shadow-lg max-w-sm text-center">
            <h2 className="text-xl font-bold mb-4">Phantom Wallet Required</h2>
            <p className="mb-4">
              To use Moonticket, you need to install the Phantom Wallet extension.
            </p>
            <a
              href="https://phantom.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-purple-600 text-white px-4 py-2 rounded"
            >
              Install Phantom
            </a>
            <button
              className="block mt-4 text-sm underline text-gray-700"
              onClick={() => setShowInstallModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
