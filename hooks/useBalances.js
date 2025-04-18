import { useEffect, useState } from "react";
import {
  Connection,
  PublicKey,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { useWallet } from "@solana/wallet-adapter-react";

const TIX_MINT_ADDRESS = new PublicKey("8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek"); // your latest $TIX mint
const connection = new Connection("https://api.mainnet-beta.solana.com");

export default function useBalances() {
  const { publicKey } = useWallet();
  const [solBalance, setSolBalance] = useState(0);
  const [tixBalance, setTixBalance] = useState(0);
  const [tixBalanceRaw, setTixBalanceRaw] = useState(null); // <- Add this

  useEffect(() => {
    if (!publicKey) return;

    const fetchBalances = async () => {
      try {
        const solLamports = await connection.getBalance(publicKey);
        setSolBalance((solLamports / 1e9).toFixed(4));

        const ata = await getAssociatedTokenAddress(TIX_MINT_ADDRESS, publicKey);
        const tokenAccount = await connection.getParsedAccountInfo(ata);

        if (tokenAccount.value) {
          const parsed = tokenAccount.value.data.parsed.info.tokenAmount;
          const uiAmount = parsed.uiAmount;
          const rawAmount = parsed.amount;

          setTixBalance(Math.floor(uiAmount));
          setTixBalanceRaw(parseInt(rawAmount)); // <- Set the raw balance
        } else {
          setTixBalance(0);
          setTixBalanceRaw(0); // <- Also set raw to 0 if no balance
        }
      } catch (err) {
        console.error("Balance error:", err);
      }
    };

    fetchBalances();
  }, [publicKey]);

  return { solBalance, tixBalance, tixBalanceRaw }; // <- Return raw
}

