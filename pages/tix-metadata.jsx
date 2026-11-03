import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

const TIX_MINT = new PublicKey("8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek");
const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const TARGET_NAME = "MoonTicket";
const TARGET_SYMBOL = "TIX";
const TARGET_URI = "https://www.moonticket.io/tix-metadata.json";

function readU32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function readU16(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

function readString(bytes, offset) {
  const length = readU32(bytes, offset);
  const start = offset + 4;
  const end = start + length;
  return {
    value: new TextDecoder().decode(bytes.slice(start, end)).replace(/\0+$/g, ""),
    offset: end,
  };
}

function decodeMetadata(bytes) {
  let offset = 1;
  const updateAuthority = new PublicKey(bytes.slice(offset, offset + 32)).toBase58();
  offset += 32;
  const mint = new PublicKey(bytes.slice(offset, offset + 32)).toBase58();
  offset += 32;

  const name = readString(bytes, offset); offset = name.offset;
  const symbol = readString(bytes, offset); offset = symbol.offset;
  const uri = readString(bytes, offset); offset = uri.offset;
  const sellerFeeBasisPoints = readU16(bytes, offset); offset += 2;

  const creatorsOption = bytes[offset]; offset += 1;
  let creators = null;

  if (creatorsOption === 1) {
    const count = readU32(bytes, offset); offset += 4;
    creators = [];
    for (let i = 0; i < count; i += 1) {
      const address = new PublicKey(bytes.slice(offset, offset + 32));
      offset += 32;
      const verified = bytes[offset] === 1; offset += 1;
      const share = bytes[offset]; offset += 1;
      creators.push({ address, verified, share });
    }
  }

  return {
    updateAuthority,
    mint,
    name: name.value,
    symbol: symbol.value,
    uri: uri.value,
    sellerFeeBasisPoints,
    creators,
  };
}

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function u16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function concat(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function borshString(value) {
  const bytes = new TextEncoder().encode(value);
  return concat([u32(bytes.length), bytes]);
}

function encodeCreators(creators) {
  if (!creators) return new Uint8Array([0]);
  const rows = creators.map((creator) =>
    concat([
      creator.address.toBytes(),
      new Uint8Array([creator.verified ? 1 : 0]),
      new Uint8Array([creator.share]),
    ])
  );
  return concat([new Uint8Array([1]), u32(creators.length), ...rows]);
}

function updateMetadataInstruction(metadataPda, updateAuthority, current) {
  // Metaplex UpdateMetadataAccount (legacy-compatible) discriminator = 1.
  // We update Data only and preserve seller fee + creators.
  const data = concat([
    borshString(TARGET_NAME),
    borshString(TARGET_SYMBOL),
    borshString(TARGET_URI),
    u16(current.sellerFeeBasisPoints),
    encodeCreators(current.creators),
  ]);

  const instructionData = concat([
    new Uint8Array([1]), // UpdateMetadataAccount
    new Uint8Array([1]), // data: Some(Data)
    data,
    new Uint8Array([0]), // updateAuthority: None (preserve)
    new Uint8Array([0]), // primarySaleHappened: None (preserve)
  ]);

  return new TransactionInstruction({
    programId: METADATA_PROGRAM,
    keys: [
      { pubkey: metadataPda, isSigner: false, isWritable: true },
      { pubkey: updateAuthority, isSigner: true, isWritable: false },
    ],
    data: instructionData,
  });
}

export default function TixMetadataAdmin() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [current, setCurrent] = useState(null);
  const [metadataPda, setMetadataPda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [pda] = PublicKey.findProgramAddressSync(
        [new TextEncoder().encode("metadata"), METADATA_PROGRAM.toBytes(), TIX_MINT.toBytes()],
        METADATA_PROGRAM
      );
      const account = await connection.getAccountInfo(pda, "confirmed");
      if (!account?.data) throw new Error("No Metaplex metadata account was found for TIX.");
      setMetadataPda(pda);
      setCurrent(decodeMetadata(new Uint8Array(account.data)));
    } catch (err) {
      setCurrent(null);
      setMessage(err?.message || "Could not read TIX metadata.");
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => { load(); }, [load]);

  const walletAddress = publicKey?.toBase58() || "";
  const isAuthority = !!current && walletAddress === current.updateAuthority;
  const alreadyUpdated =
    current?.name === TARGET_NAME &&
    current?.symbol === TARGET_SYMBOL &&
    current?.uri === TARGET_URI;

  const target = useMemo(() => ({
    name: TARGET_NAME,
    symbol: TARGET_SYMBOL,
    uri: TARGET_URI,
  }), []);

  async function updateMetadata() {
    if (!publicKey || !metadataPda || !current) return;
    if (!isAuthority) {
      setMessage("Connect the wallet shown as the on-chain update authority.");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const ix = updateMetadataInstruction(metadataPda, publicKey, current);
      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      const latest = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = latest.blockhash;

      const signature = await sendTransaction(tx, connection, { skipPreflight: false });
      setMessage("Transaction submitted: " + signature);
      await connection.confirmTransaction(
        { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
        "confirmed"
      );
      setMessage("TIX metadata updated successfully. Transaction: " + signature);
      await load();
    } catch (err) {
      console.error("TIX metadata update failed:", err);
      setMessage(err?.message || "The metadata update transaction failed.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-yellow-400 pt-36 pb-20 px-4">
      <main className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold">TIX Metadata Update</h1>
        <p className="mt-3 text-sm opacity-80">
          This tool changes only the Metaplex metadata for the existing TIX mint. It does not mint,
          burn, transfer, or change anyone&apos;s token balance.
        </p>

        {loading ? (
          <p className="mt-8">Reading TIX metadata from Solana…</p>
        ) : current ? (
          <>
            <section className="mt-8 border border-yellow-400/30 rounded-xl p-5">
              <h2 className="text-xl font-bold">Current On-Chain Metadata</h2>
              <div className="mt-4 space-y-2 text-sm">
                <p><strong>Name:</strong> {current.name || "—"}</p>
                <p><strong>Symbol:</strong> {current.symbol || "—"}</p>
                <p className="break-all"><strong>URI:</strong> {current.uri || "—"}</p>
                <p className="break-all"><strong>Update authority:</strong> {current.updateAuthority}</p>
                <p><strong>Seller fee:</strong> {current.sellerFeeBasisPoints} bps</p>
                <p><strong>Creators:</strong> {current.creators ? current.creators.length : 0}</p>
              </div>
            </section>

            <section className="mt-6 border border-yellow-400/30 rounded-xl p-5">
              <h2 className="text-xl font-bold">New Metadata</h2>
              <div className="mt-4 space-y-2 text-sm">
                <p><strong>Name:</strong> {target.name}</p>
                <p><strong>Symbol:</strong> {target.symbol}</p>
                <p className="break-all"><strong>URI:</strong> {target.uri}</p>
                <p><strong>Logo:</strong> https://www.moonticket.io/moonticket-logo.png</p>
              </div>
            </section>

            <section className="mt-6 border border-yellow-400/30 rounded-xl p-5">
              <div className="text-sm">
                <p className="break-all"><strong>Connected wallet:</strong> {walletAddress || "Not connected"}</p>
                <p className="mt-2">
                  Authority check:{" "}
                  <strong className={isAuthority ? "text-green-400" : "text-red-400"}>
                    {isAuthority ? "MATCH — authorized" : "NO MATCH"}
                  </strong>
                </p>
              </div>

              {alreadyUpdated ? (
                <div className="mt-5 text-green-400 font-bold">✓ TIX metadata already matches the new MoonTicket metadata.</div>
              ) : (
                <button
                  onClick={updateMetadata}
                  disabled={!isAuthority || working}
                  className="mt-5 bg-yellow-400 text-black font-bold rounded-lg px-6 py-3 disabled:opacity-40"
                >
                  {working ? "Updating…" : "Update TIX Metadata"}
                </button>
              )}
            </section>
          </>
        ) : null}

        {message && <p className="mt-6 break-all">{message}</p>}

        <div className="mt-8">
          <button onClick={load} disabled={loading || working}
            className="border border-yellow-400 rounded px-4 py-2 disabled:opacity-40">
            Refresh Metadata
          </button>
        </div>
      </main>
    </div>
  );
}
