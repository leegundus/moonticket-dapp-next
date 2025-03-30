import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

const TIX_MINT = new PublicKey("CnDaNe3EpAgu2R2aK49nhnH9byf9Y3TWpm689uxavMbM");
const DECIMALS = 9;
const SOLANA_RPC = "https://api.devnet.solana.com";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FOUR_WEEKS_MS = 4 * ONE_WEEK_MS;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { walletAddress, tixBalanceRaw } = req.body;

  if (!walletAddress || !tixBalanceRaw) {
    return res.status(400).json({ error: "Missing wallet or balance" });
  }

  const userPubkey = new PublicKey(walletAddress);
  const connection = new Connection(SOLANA_RPC, "confirmed");

  try {
    const currentTime = Date.now();
    const weekAgo = currentTime - ONE_WEEK_MS;
    const fourWeeksAgo = currentTime - FOUR_WEEKS_MS;

    const userAta = await getAssociatedTokenAddress(TIX_MINT, userPubkey);
    console.log("User ATA:", userAta.toBase58());

    const signatures = await connection.getSignaturesForAddress(userPubkey, { limit: 100 });
    console.log("Signatures:", signatures.map((s) => s.signature));

    let weeklyTix = 0;
    let monthlyTix = 0;

    for (const sigInfo of signatures) {
      const tx = await connection.getParsedTransaction(sigInfo.signature, "confirmed");
      if (!tx || !tx.blockTime) continue;

      const blockTime = tx.blockTime * 1000;
      const instructions = tx.transaction.message.instructions;

      for (const ix of instructions) {
        if (
          ix.programId.toString() === TOKEN_PROGRAM_ID.toString() &&
          ["transfer", "transferChecked"].includes(ix.parsed?.type) &&
          new PublicKey(ix.parsed?.info?.destination).equals(userAta)
        ) {
          let mint = ix.parsed?.info?.mint;

          // Use fallback tokenAmount if needed
          let rawAmount = ix.parsed?.info?.amount ?? ix.parsed?.info?.tokenAmount?.amount;
          const amount = rawAmount ? Number(rawAmount) : 0;

          if (!mint && ix.parsed?.info?.source) {
            try {
              const sourceInfo = await connection.getParsedAccountInfo(
                new PublicKey(ix.parsed.info.source)
              );
              mint = sourceInfo?.value?.data?.parsed?.info?.mint;
              console.log("Fetched mint from source ATA:", mint);
            } catch (e) {
              console.warn("Failed to fetch mint from source:", e.message);
            }
          }

          console.log("Evaluating potential $TIX match:", {
            type: ix.parsed?.type,
            amount,
            rawAmount,
            mint,
            expected: TIX_MINT.toString(),
            destination: ix.parsed?.info?.destination,
            time: blockTime,
          });

          if (mint === TIX_MINT.toString() && !isNaN(amount)) {
            console.log("MATCHED $TIX TRANSFER!");
            if (blockTime >= weekAgo) weeklyTix += amount;
            if (blockTime >= fourWeeksAgo) monthlyTix += amount;
          }
        }
      }
    }

    const tixBalance = Number(tixBalanceRaw);
    const requiredWeekly = Math.floor(weeklyTix * 0.25);
    const requiredMonthly = Math.floor(monthlyTix * 0.25);

    const ENTRY_UNIT = 100000 * (10 ** DECIMALS);
    const weeklyEntries = Math.floor(weeklyTix / ENTRY_UNIT);
    const monthlyEntries = Math.floor(monthlyTix / ENTRY_UNIT);

    res.status(200).json({
      weeklyPurchased: Math.floor(weeklyTix / 10 ** DECIMALS),
      monthlyPurchased: Math.floor(monthlyTix / 10 ** DECIMALS),
      requiredWeeklyHodl: Math.floor(requiredWeekly / 10 ** DECIMALS),
      requiredMonthlyHodl: Math.floor(requiredMonthly / 10 ** DECIMALS),
      eligibleForMoon: tixBalance >= requiredWeekly,
      eligibleForMega: tixBalance >= requiredMonthly,
      weeklyEntries,
      monthlyEntries,
    });
  } catch (err) {
    console.error("HODL Info error:", err.message);
    res.status(500).json({ error: "Failed to calculate HODL info" });
  }
}
