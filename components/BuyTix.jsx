import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

const SOL_PRICE_USD = 180;
const TIX_PRICE_USD = 0.00001;

const BuyTix = () => {
  const { publicKey } = useWallet();
  const [solAmount, setSolAmount] = useState("");
  const [tixAmount, setTixAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSolChange = (e) => {
    const input = e.target.value;
    setSolAmount(input);

    const usdAmount = parseFloat(input) * SOL_PRICE_USD;
    const tix = usdAmount / TIX_PRICE_USD;
    setTixAmount(Math.floor(tix));
  };

  const handleBuy = async () => {
    if (!publicKey || !solAmount) {
      alert("Please connect your wallet and enter a SOL amount.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/buyTix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          solAmount: parseFloat(solAmount),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Success! You bought ${data.tixAmount.toLocaleString()} $TIX.`);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(`Unexpected error: ${err.message}`);
    }

    setLoading(false);
  };

  return (
    <div>
      <h2>Buy $TIX</h2>
      <p>Current Price: ${TIX_PRICE_USD.toFixed(5)} per $TIX</p>
      <label>
        Enter amount of SOL to spend:
        <input
          type="number"
          value={solAmount}
          onChange={handleSolChange}
          placeholder="e.g. 0.1"
          min="0"
          step="0.01"
        />
      </label>

      {tixAmount > 0 && (
        <div style={{ marginTop: "10px" }}>
          <p>You’ll receive: <strong>{tixAmount.toLocaleString()}</strong> $TIX</p>
          <button onClick={handleBuy} disabled={loading || !publicKey}>
            {loading ? "Processing..." : "Buy $TIX"}
          </button>
        </div>
      )}

      {message && (
        <p style={{ marginTop: "10px", fontWeight: "bold" }}>{message}</p>
      )}
    </div>
  );
};

export default BuyTix;

