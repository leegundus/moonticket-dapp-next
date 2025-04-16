import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import TweetEntryModal from "./TweetEntryModal";

export default function BuyTix() {
  const { publicKey, signTransaction } = useWallet();
  const [solInput, setSolInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [solPriceUsd, setSolPriceUsd] = useState(null);
  const [tixPriceUsd, setTixPriceUsd] = useState(null);
  const [tixAmount, setTixAmount] = useState(0);
  const [entries, setEntries] = useState(0);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [pricesLoaded, setPricesLoaded] = useState(false);

  const TREASURY_WALLET = new PublicKey("FrAvtjXo5JCsWrjcphvWCGQDrXX8PuEbN2qu2SGdvurG");
  const OPS_WALLET = new PublicKey("nJmonUssRvbp85Nvdd9Bnxgh86Hf6BtKfu49RdcoYE9");

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setPricesLoaded(false);
        const res = await fetch("/api/prices");
        const data = await res.json();
        setSolPriceUsd(data.solPriceUsd);
        setTixPriceUsd(data.tixPriceUsd);
        setPricesLoaded(true);
      } catch (err) {
        console.error("Failed to fetch price data:", err);
      }
    };

    if (publicKey) {
      fetchPrices();
    }

    const provider = window?.solana;
    if (provider?.on) {
      const handleAccountChange = () => {
        fetchPrices();
        setSolInput("");
        setTixAmount(0);
        setEntries(0);
        setResult(null);
      };

      provider.on("accountChanged", handleAccountChange);
      return () => provider.removeListener("accountChanged", handleAccountChange);
    }
  }, [publicKey]);

  useEffect(() => {
    const sol = parseFloat(solInput);
    if (!isNaN(sol) && sol > 0 && solPriceUsd > 0 && tixPriceUsd > 0) {
      const usdSpent = sol * solPriceUsd;
      const tix = Math.floor(usdSpent / tixPriceUsd);
      const entryCount = usdSpent;
      setTixAmount(tix);
      setEntries(entryCount);
    } else {
      setTixAmount(0);
      setEntries(0);
    }
  }, [solInput, solPriceUsd, tixPriceUsd]);

  const handleBuy = async () => {
    if (!publicKey || isNaN(parseFloat(solInput))) return;
    setLoading(true);
    setResult(null);

    try {
      const connection = new Connection("https://api.devnet.solana.com");
      const totalLamports = Math.floor(parseFloat(solInput) * 1e9);
      const opsLamports = Math.floor(totalLamports * 0.01);
      const treasuryLamports = totalLamports - opsLamports;

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: TREASURY_WALLET,
          lamports: treasuryLamports,
        }),
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: OPS_WALLET,
          lamports: opsLamports,
        })
      );

      const blockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash.blockhash;
      tx.feePayer = publicKey;

      const signedTx = await signTransaction(tx);
      const txid = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(txid, "confirmed");

      const res = await fetch("/api/buyTix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          solAmount: parseFloat(solInput),
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Buy TIX failed:", err);
      setResult({ success: false, error: "Failed to buy TIX" });
    }

    setLoading(false);
  };

  return (
    <div className="bg-black text-yellow-400 min-h-screen p-6">
      <h1 className="text-2xl font-bold mb-4">Buy $TIX</h1>
      <p>
        Live SOL: {solPriceUsd ? `$${solPriceUsd.toFixed(2)}` : "Loading..."} |
        $TIX: {tixPriceUsd ? `$${tixPriceUsd.toFixed(5)}` : "Loading..."}
      </p>

      <div className="my-4">
        <label>Enter SOL:</label>
        <input
          type="number"
          value={solInput}
          onChange={(e) => setSolInput(e.target.value)}
          placeholder="e.g. 0.05"
          className="text-black p-2 ml-2 w-32 rounded"
        />
      </div>

      {result && result.success ? (
        <div className="mb-4">
          <p><strong>You’ll receive:</strong> {result.tixAmount.toLocaleString()} $TIX</p>
          <p><strong>Entries earned:</strong> {result.usdSpent.toFixed(2)}</p>
        </div>
      ) : tixAmount > 0 && (
        <div className="mb-4">
          <p><strong>You’ll receive:</strong> {tixAmount.toLocaleString()} $TIX</p>
          <p><strong>Entries earned:</strong> {entries.toFixed(2)}</p>
        </div>
      )}

      <button
        onClick={handleBuy}
        disabled={loading || !publicKey || !pricesLoaded}
        className="bg-yellow-400 text-black font-semibold px-4 py-2 rounded hover:bg-yellow-300"
      >
        {loading || !pricesLoaded ? "Loading..." : "Buy $TIX"}
      </button>

      {result && result.success && (
        <>
          <div className="mt-4 text-green-400">
            <p>Success! You bought {result.tixAmount.toLocaleString()} $TIX</p>
            <p>using {result.solAmount} SOL (~${result.usdSpent.toFixed(2)} USD).</p>
            <p>
              Rate: ${result.tixPriceUsd?.toFixed(5)} per $TIX | SOL: ${result.solPriceUsd?.toFixed(2)}
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-white mb-2">Get 1 bonus entry by tweeting!</p>
            <img
              src="/freeTix-button.png"
              alt="Claim Bonus Entry"
              className="mx-auto cursor-pointer hover:scale-105 transition"
              onClick={() => setShowBonusModal(true)}
            />
          </div>

          <TweetEntryModal
            isOpen={showBonusModal}
            onClose={() => setShowBonusModal(false)}
            isBonus={true}
          />
        </>
      )}

      {result && !result.success && (
        <div className="mt-4 text-red-400">
          <p>{result.error || "An error occurred."}</p>
        </div>
      )}
    </div>
  );
}
