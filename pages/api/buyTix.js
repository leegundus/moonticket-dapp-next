import { createRequire } from "module";
const require = createRequire(import.meta.url);
const buyTix = require("../../lib/buyTix");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { walletAddress, solAmount } = req.body;

  if (!walletAddress || isNaN(solAmount)) {
    return res.status(400).json({ error: "Missing wallet or SOL amount" });
  }

  try {
    const result = await buyTix(walletAddress, solAmount);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("BuyTix API error:", err);
    return res.status(500).json({
      error: err?.message || "Internal Server Error"
    });
  }
}
