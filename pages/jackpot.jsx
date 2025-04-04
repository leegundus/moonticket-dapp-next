import dynamic from "next/dynamic";
import dynamicWalletProvider from "../wallet/WalletProvider";

const Jackpot = dynamic(() => import("../components/Jackpot"), { ssr: false });

export default function JackpotPage() {
  return dynamicWalletProvider(<Jackpot />);
}
