import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import TweetEntryModal from "./TweetEntryModal";

export default function BuyTix() {
  const { publicKey } = useWallet();
  const [solInput, setSolInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [solPriceUsd, setSolPriceUsd] = useState(null);
  const [tixPriceUsd, setTixPriceUsd] = useState(null);
  const [solBalance, setSolBalance] = useState(null);
  const [showBonusModal, setShowBonusModal] = useState(false);

  const TREASURY_WALLET = new PublicKey("FrAvtjXo5JCsWrjcphvWCGQDrXX8PuEbN2qu2SGdvurG");
  const OPS_WALLET = new PublicKey("nJmonUssRvbp85Nvdd9Bnxgh86Hf6BtKfu49RdcoYE9");

  useEffect(() => {
    if (publicKey) fetchSolBalance();
  }, [publicKey]);

  const fetchSolBalance = async () => {
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
    const balance = await connection.getBalance(publicKey);
    setSolBalance(balance / 1e9);
  };

  useEffect(() => {
    const fetchPrices = async () => {
      const res = await fetch("/api/prices");
      const data = await res.json();
      setSolPriceUsd(data.solPriceUsd);
      setTixPriceUsd(data.tixPriceUsd);
    };
    fetchPrices();
  }, []);

  const handleBuy = async () => {
    if (!publicKey || isNaN(parseFloat(solInput))) return;
    setLoading(true);
    setResult(null);

    try {
      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL);
      const totalLamports = Math.floor(parseFloat(solInput) * 1e9);
      const opsLamports = Math.floor(totalLamports * 0.01);
      const treasuryLamports = totalLamports - opsLamports;

      // Step 1: Send SOL from user → Treasury + Ops
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

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      // Ensure we confirm with the actual signature string
      const sigRes = await window.solana.signAndSendTransaction(tx);
      const sig1 = typeof sigRes === "string" ? sigRes : sigRes.signature;
      await connection.confirmTransaction({ signature: sig1 }, "confirmed");

      // Step 2a: Prepare SPL-token transfer where BUYER pays fee (server partially signs)
      const prepRes = await fetch("/api/buyTix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          solAmount: parseFloat(solInput),
        }),
      });
      const prep = await prepRes.json();
      if (!prep.success || !prep.txBase64) throw new Error(prep.error || "Prepare failed");

      // Buyer signs & sends the partially-signed tx
      const bytes = Uint8Array.from(atob(prep.txBase64), (c) => c.charCodeAt(0));
      const sigRes2 = await window.solana.signAndSendTransaction({ serializedTransaction: bytes });
      const sig2 = typeof sigRes2 === "string" ? sigRes2 : sigRes2.signature;
      await connection.confirmTransaction({ signature: sig2 }, "confirmed");

      // Step 2b: Finalize (record purchase + credits)
      const finRes = await fetch("/api/buyTix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          solAmount: parseFloat(solInput),
          txSig: sig2,
        }),
      });
      const data = await finRes.json();
      if (!data.success) throw new Error(data.error || "Finalize failed");

      setResult(data);
      fetchSolBalance();
    } catch (err) {
      console.error("Buy TIX failed:", err);
      setResult({ success: false, error: "Failed to buy TIX" });
    }

    setLoading(false);
  };

  // --- Live preview calculations (no API change needed) ---
  const sol = Number(solInput || 0);
  const usdPreview =
    solPriceUsd != null && !Number.isNaN(sol) ? sol * solPriceUsd : 0;
  const creditsPreview = Math.floor(usdPreview + 1e-6); // 1 credit per $1
  const tixPreview =
    tixPriceUsd != null && tixPriceUsd > 0
      ? Math.floor(usdPreview / tixPriceUsd)
      : 0;

  // After-purchase credits (from API response)
  const creditsEarned =
    result && result.success && typeof result.usdSpent === "number"
      ? Math.floor(result.usdSpent + 1e-6)
      : null;

  return (
    <div className="bg-black text-yellow-400 min-h-screen p-6 text-center pt-40">
      <h1 className="text-3xl font-bold mb-2">The Official Token of Moonticket</h1>
      <p className="text-lg mb-6">Get your TIX to the moon.</p>
      <img src="/tix-coin-web.png" alt="$TIX Coin" className="mx-auto mb-6" />

      {!publicKey ? (
        <p>Connect wallet to buy TIX.</p>
      ) : (
        <>
          <p>
            Live SOL: ${solPriceUsd?.toFixed(2) || "?"} | TIX: ${tixPriceUsd?.toFixed(5) || "?"}
          </p>
          <p className="text-sm mt-1">SOL Balance: {solBalance?.toFixed(4) || "?"} SOL</p>

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

          {/* --- NEW: Live preview before purchase --- */}
          {publicKey && solPriceUsd != null && tixPriceUsd != null && sol > 0 && (
            <div className="mb-4">
              <p>USD est: <strong>${usdPreview.toFixed(2)}</strong></p>
              <p>You’ll receive: <strong>{tixPreview.toLocaleString()}</strong> TIX</p>
              <p>You’ll get: <strong>{creditsPreview}</strong> ticket credit{creditsPreview === 1 ? "" : "s"}</p>
            </div>
          )}

          {/* This block (existing) shows after purchase */}
          {result && result.success ? (
            <div className="mb-4">
              <p><strong>You’ll receive:</strong> {result.tixAmount.toLocaleString()} TIX</p>
            </div>
          ) : null}

          <img
            src="/buyTix-button.png"
            alt="Buy $TIX"
            onClick={handleBuy}
            className="mx-auto mt-4 w-64 h-auto cursor-pointer hover:scale-105 transition"
          />

          {result && result.success && (
            <>
              <div className="mt-4 text-green-400">
                <p>Success! You bought {result.tixAmount.toLocaleString()} TIX</p>
                <p>using {result.solAmount} SOL (~${result.usdSpent.toFixed(2)} USD)</p>
                <p>Rate: ${result.tixPriceUsd?.toFixed(5)} | SOL: ${result.solPriceUsd?.toFixed(2)}</p>
                {/* --- NEW: show credits earned after purchase --- */}
                {creditsEarned != null && (
                  <p className="mt-1">
                    You received <strong>{creditsEarned}</strong> ticket credit{creditsEarned === 1 ? "" : "s"}.
                  </p>
                )}
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
    </div>
  );
}
