import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import TweetEntryModal from "./TweetEntryModal";

export default function BuyTix() {
  const { publicKey, signTransaction } = useWallet();
  const [walletKey, setWalletKey] = useState(0);
  const [solInput, setSolInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [solPriceUsd, setSolPriceUsd] = useState(null);
  const [tixPriceUsd, setTixPriceUsd] = useState(null);
  const [tixAmount, setTixAmount] = useState(0);
  const [entries, setEntries] = useState(0);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [showReload, setShowReload] = useState(false); // NEW

  const TREASURY_WALLET = new PublicKey("FrAvtjXo5JCsWrjcphvWCGQDrXX8PuEbN2qu2SGdvurG");
  const OPS_WALLET = new PublicKey("nJmonUssRvbp85Nvdd9Bnxgh86Hf6BtKfu49RdcoYE9");

  useEffect(() => {
    const hasReloaded = sessionStorage.getItem("walletReloaded");
    if (typeof window !== "undefined" && window.solana?.isConnected && !publicKey && !hasReloaded) {
      sessionStorage.setItem("walletReloaded", "true");
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    if (publicKey) {
      setWalletKey((prev) => prev + 1);
    }
  }, [publicKey]);

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
        sessionStorage.removeItem("walletReloaded");
        window.location.reload();
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

  // NEW: Show reload button if Phantom is connected but publicKey not ready
  useEffect(() => {
    const checkReloadStatus = () => {
      if (typeof window !== "undefined" && window.solana?.isConnected && !publicKey) {
        setShowReload(true);
      } else {
        setShowReload(false);
      }
    };
    checkReloadStatus();
    const interval = setInterval(checkReloadStatus, 500);
    return () => clearInterval(interval);
  }, [publicKey]);

  const handleBuy = async () => {
    if (!publicKey || isNaN(parseFloat(solInput))) return;
    setLoading(true);
    setResult(null);

    try {
      const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=47d9c64e-1d5a-4623-abaf-ee532aca9eaa");
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

      const txid = await window.solana.signAndSendTransaction(tx);
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

    // Fire Google Ads conversion event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'conversion', {
        send_to: 'AW-17029981561/Bt7VCP6hzb0aEPnKw7g_',
        transaction_id: ''
    });
   }
  };

  return (
    <div className="bg-black text-yellow-400 min-h-screen p-6 text-center pt-40" key={walletKey}>
      <h1 className="text-3xl font-bold mb-2">The Official Token of Moonticket</h1>
      <p className="text-lg mb-6">Get your TIX to the moon.</p>

      <img src="/tix-coin-web.png" alt="$TIX Coin" className="mx-auto mb-6" />

      {!publicKey ? (
        <>
          <p>
            {typeof window !== "undefined" && window?.solana?.isConnected && !publicKey
              ? "Wallet connected."
              : "Connect wallet to buy TIX."}
          </p>
        </>
      ) : !pricesLoaded ? (
        <>
          <p>Wallet connected.</p>
        </>
      ) : (
        <>
          <p>
            Live SOL: {solPriceUsd ? `$${solPriceUsd.toFixed(2)}` : "Loading..."} |
            TIX: {tixPriceUsd ? `$${tixPriceUsd.toFixed(5)}` : "Loading..."}
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
              <p><strong>You’ll receive:</strong> {result.tixAmount.toLocaleString()} TIX</p>
              <p><strong>Entries earned:</strong> {result.usdSpent.toFixed(2)}</p>
            </div>
          ) : tixAmount > 0 && (
            <div className="mb-4">
              <p><strong>You’ll receive:</strong> {tixAmount.toLocaleString()} TIX</p>
              <p><strong>Entries earned:</strong> {entries.toFixed(2)}</p>
            </div>
          )}
    {(!loading && pricesLoaded) ? (
    <img
      src="/buyTix-button.png"
      alt="Buy $TIX"
      onClick={handleBuy}
      className="mx-auto mt-4 w-64 h-auto cursor-pointer hover:scale-105 transition"
    />
  ) : (
    <p className="mt-4 text-yellow-400">Loading...</p>
  )}
          {result && result.success && (
            <>
              <div className="mt-4 text-green-400">
                <p>Success! You bought {result.tixAmount.toLocaleString()} TIX</p>
                <p>using {result.solAmount} SOL (~${result.usdSpent.toFixed(2)} USD).</p>
                <p>
                  Rate: ${result.tixPriceUsd?.toFixed(5)} per TIX | SOL: ${result.solPriceUsd?.toFixed(2)}
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
        </>
      )}

      {showReload && (
        <img
          src="/load-prices-button.png"
          alt="Load Prices"
          className="w-96 h-auto mx-auto mt-4 cursor-pointer hover:scale-105 transition"
          onClick={() => window.location.reload()}
        />
      )}
    <p className="text-xs text-yellow-300 mt-10">
      No purchase neccessary to enter or win.  See Jackpot page for details.
    </p> 
    </div>
  );
}
