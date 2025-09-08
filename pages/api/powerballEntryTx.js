module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  console.log("[API DEBUG] /api/powerballEntryTx method:", req.method);
  return res.status(200).json({
    ok: true,
    seenMethod: req.method,
    note: "debug echo — if this is not POST, something is flipping the method",
  });
};
