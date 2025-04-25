import dynamic from "next/dynamic";
import dynamicWalletProvider from "../wallet/WalletProvider";

const BuyTix = dynamic(() => import("../components/BuyTix"), { ssr: false });

export default function BuyTixPage() {
  return dynamicWalletProvider(
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center pt-8 pt-40">
          <BuyTix />
    </div>
  );
}
