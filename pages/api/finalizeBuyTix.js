// The former finalization API accepted caller-supplied transactions and
// signed them with the server-held Treasury key. That is unsafe because the
// server must never co-sign untrusted transaction instructions.
//
// The live Buy TIX page uses a Jupiter-routed swap instead.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(410).json({
    error: "Legacy direct TIX purchase finalization is disabled.",
  });
}
