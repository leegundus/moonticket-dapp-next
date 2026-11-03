import crypto from "crypto";

export const ADMIN_WALLET =
  process.env.MOONTICKET_ADMIN_WALLET || "FrAvtjXo5JCsWrjcphvWCGQDrXX8PuEbN2qu2SGdvurG";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function decodeBase58(value) {
  let num = 0n;
  for (const ch of value) {
    const index = ALPHABET.indexOf(ch);
    if (index < 0) throw new Error("Invalid base58");
    num = num * 58n + BigInt(index);
  }
  const bytes = [];
  while (num > 0n) {
    bytes.push(Number(num & 255n));
    num >>= 8n;
  }
  bytes.reverse();
  let leading = 0;
  while (leading < value.length && value[leading] === "1") leading += 1;
  return Buffer.concat([Buffer.alloc(leading), Buffer.from(bytes)]);
}

export function adminMessage(action, timestamp, payload) {
  return [
    "MoonTicket Admin",
    "Action: " + action,
    "Timestamp: " + timestamp,
    "Payload: " + JSON.stringify(payload || {}),
  ].join("\n");
}

export function verifyAdminRequest(body, action) {
  const wallet = String(body?.wallet || "");
  const timestamp = Number(body?.timestamp);
  const signature = String(body?.signature || "");
  const payload = body?.payload || {};

  if (wallet !== ADMIN_WALLET) return { ok: false, error: "Owner wallet required." };
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return { ok: false, error: "Admin approval expired. Try again." };
  }

  try {
    const raw = decodeBase58(wallet);
    if (raw.length !== 32) return { ok: false, error: "Invalid owner wallet." };
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const publicKey = crypto.createPublicKey({
      key: Buffer.concat([spkiPrefix, raw]),
      format: "der",
      type: "spki",
    });
    const message = Buffer.from(adminMessage(action, timestamp, payload), "utf8");
    const sig = Buffer.from(signature, "base64");
    const valid = crypto.verify(null, message, publicKey, sig);
    return valid ? { ok: true, payload } : { ok: false, error: "Invalid owner signature." };
  } catch {
    return { ok: false, error: "Could not verify owner signature." };
  }
}
