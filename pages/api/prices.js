// pages/api/prices.js

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const mockSolPrice = 115.56; // Replace with actual API call later if needed
  const tixPriceUsd = 0.0001;

  return res.status(200).json({
    solPriceUsd: mockSolPrice,
    tixPriceUsd,
  });
}
