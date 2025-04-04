import dynamic from "next/dynamic";
import dynamicWalletProvider from "../wallet/WalletProvider";

const BuyTix = dynamic(() => import("../components/BuyTix"), { ssr: false });

export default function BuyTixPage() {
  return dynamicWalletProvider(
    <div className="min-h-screen">
      <BuyTix />
    </div>
  );
}
