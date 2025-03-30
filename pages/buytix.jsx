import dynamic from "next/dynamic";
import dynamicWalletProvider from "../wallet/WalletProvider";

const BuyTix = dynamic(() => import("../components/BuyTix"), { ssr: false });

export default function BuyTixPage() {
  return dynamicWalletProvider(<BuyTix />);
}
