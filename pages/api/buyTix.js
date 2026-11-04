// The former direct-sale API trusted caller-provided purchase amounts and
// signed TIX transfers using a server-held Treasury key without verifying
// an on-chain payment. Do not re-enable this endpoint.
//
// The live Buy TIX page uses a Jupiter-routed swap instead.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(410).json({
    error: "Legacy direct TIX purchases are disabled. Use /buytix for Jupiter swaps.",
  });
}
