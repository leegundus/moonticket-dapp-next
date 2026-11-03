import { PublicKey } from "@solana/web3.js";

const MINT = new PublicKey("8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek");
const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

async function rpc(method, params) {
  const endpoint = process.env.NEXT_PUBLIC_RPC_URL;
  if (!endpoint) throw new Error("RPC not configured");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body?.error?.message || "RPC request failed");
  return body.result;
}

function readString(buffer, offset) {
  const length = buffer.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + length;
  return {
    value: buffer.subarray(start, end).toString("utf8").replace(/\0+$/g, ""),
    offset: end,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METADATA_PROGRAM.toBuffer(), MINT.toBuffer()],
      METADATA_PROGRAM
    );

    let das = null;
    try {
      das = await rpc("getAsset", { id: MINT.toBase58() });
    } catch {}

    const account = await rpc("getAccountInfo", [
      metadataPda.toBase58(),
      { encoding: "base64", commitment: "confirmed" },
    ]);

    if (!account?.value?.data?.[0]) {
      return res.status(200).json({
        mint: MINT.toBase58(),
        metadataPda: metadataPda.toBase58(),
        das,
        metaplexMetadataFound: false,
      });
    }

    const buffer = Buffer.from(account.value.data[0], "base64");
    let offset = 1;
    const updateAuthority = new PublicKey(buffer.subarray(offset, offset + 32)).toBase58();
    offset += 32;
    const mint = new PublicKey(buffer.subarray(offset, offset + 32)).toBase58();
    offset += 32;

    const name = readString(buffer, offset); offset = name.offset;
    const symbol = readString(buffer, offset); offset = symbol.offset;
    const uri = readString(buffer, offset); offset = uri.offset;
    const sellerFeeBasisPoints = buffer.readUInt16LE(offset);

    return res.status(200).json({
      mint: MINT.toBase58(),
      metadataPda: metadataPda.toBase58(),
      metaplexMetadataFound: true,
      updateAuthority,
      metadataMint: mint,
      name: name.value,
      symbol: symbol.value,
      uri: uri.value,
      sellerFeeBasisPoints,
      das,
    });
  } catch (err) {
    console.error("TIX metadata check error:", err);
    return res.status(500).json({ error: err?.message || "Metadata check failed" });
  }
}
