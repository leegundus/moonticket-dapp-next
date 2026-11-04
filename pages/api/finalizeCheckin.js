// Retired daily-check-in endpoint. The public weekly drawing uses /api/claimFreeEntry.
// This route must not access the Treasury signing key or grant unverified rewards.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(410).json({
    error: "Legacy daily check-in has been retired. Use the free weekly drawing entry.",
  });
}
