import React, { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import useBalances from "../hooks/useBalances";

import dynamic from "next/dynamic";
import dynamicWalletProvider from "../wallet/WalletProvider";

const Jackpot = dynamic(() => import("../components/Jackpot"), { ssr: false });

export default function JackpotPage() {
  return dynamicWalletProvider(<Jackpot />);
}
