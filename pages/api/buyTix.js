import { createRequire } from "module";
const require = createRequire(import.meta.url);

const buyTix = require("../../lib/buyTix").default || require("../../lib/buyTix");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { buyerPublicKey, solAmount } = req.body;

  if (!walletAddress || isNaN(solAmount)) {
    return res.status(400).json({ error: "Missing wallet or SOL amount" });
  }

  try {
    // Fully rely on lib/buyTix.js to handle ATA creation (cleaner and consistent)
    const result = await buyTix(buyerPublicKey, solAmount);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("BuyTix API error:", err);
    return res.status(500).json({
      error: err?.message || "Internal Server Error"
    });
  }
}
