// pages/buytix.js

import dynamic from "next/dynamic";
import dynamicWalletProvider from "../wallet/WalletProvider";

const BuyTix = dynamic(() => import("../components/BuyTix"), { ssr: false });

export default function BuyTixPage() {
  return dynamicWalletProvider(
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center pt-8">
      {/* Centered Logo at Top */}
      <img
        src="/tix-coin-web.png"
        alt="$TIX Coin"
        className="w-40 md:w-52 lg:w-64 mb-6"
      />

      {/* Centered BuyTix Component */}
      <div className="w-full flex justify-center">
        <div className="max-w-md w-full px-4 text-center">
          <BuyTix />
        </div>
      </div>
    </div>
  );
}
