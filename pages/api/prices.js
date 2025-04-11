// pages/api/prices.js

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const coingeckoRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );

    if (!coingeckoRes.ok) {
      throw new Error("Failed to fetch SOL price from CoinGecko");
    }

    const data = await coingeckoRes.json();
    const solPriceUsd = data?.solana?.usd || 0;
    const tixPriceUsd = 0.0001;

    return res.status(200).json({
      solPriceUsd,
      tixPriceUsd,
    });
  } catch (err) {
    console.error("Price API error:", err.message);
    return res.status(500).json({ error: "Failed to fetch prices" });
  }
}
