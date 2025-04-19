// pages/api/buyTix.js
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const buyTix = require("../../lib/buyTix").default || require("../../lib/buyTix");

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { walletAddress, solAmount } = req.body;

    if (!walletAddress || isNaN(solAmount)) {
      return res.status(400).json({ error: "Missing or invalid walletAddress or solAmount" });
    }

    const result = await buyTix(walletAddress, solAmount);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("BuyTix API error:", err);
    return res.status(500).json({ error: err.message || "Internal Server Error" });
  }
}
