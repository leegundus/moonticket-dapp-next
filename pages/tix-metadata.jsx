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
  let offset = 0;
  // Metaplex MetadataV1 account discriminator.
  if (bytes[offset++] !== 4) {
    throw new Error("The TIX account is not a Metaplex MetadataV1 account.");
  }
  const updateAuthority = new PublicKey(bytes.slice(offset, offset + 32)).toBase58();
  offset += 32;
  const mint = new PublicKey(bytes.slice(offset, offset + 32)).toBase58();
  offset += 32;

  const name = readString(bytes, offset); offset = name.offset;
  const symbol = readString(bytes, offset); offset = symbol.offset;
  const uri = readString(bytes, offset); offset = uri.offset;
  const sellerFeeBasisPoints = readU16(bytes, offset); offset += 2;

  const creatorsOption = bytes[offset++];
  if (creatorsOption !== 0 && creatorsOption !== 1) {
    throw new Error("Unexpected creators field in TIX metadata.");
  }
  let creators = null;
  if (creatorsOption === 1) {
    const count = readU32(bytes, offset); offset += 4;
    if (count > 5) throw new Error("Unexpected creator count in TIX metadata.");
    creators = [];
    for (let i = 0; i < count; i += 1) {
      const address = new PublicKey(bytes.slice(offset, offset + 32));
      offset += 32;
      const verified = bytes[offset++] === 1;
      const share = bytes[offset++];
      creators.push({ address, verified, share });
    }
  }

  const primarySaleHappened = bytes[offset++] === 1;
  const isMutable = bytes[offset++] === 1;
  const editionNonceOption = bytes[offset++] ?? 0;
  if (editionNonceOption === 1) offset += 1;
  else if (editionNonceOption !== 0) throw new Error("Unexpected edition nonce in metadata.");

  const tokenStandardOption = bytes[offset++] ?? 0;
  let tokenStandard = null;
  if (tokenStandardOption === 1) tokenStandard = bytes[offset++];
  else if (tokenStandardOption !== 0) throw new Error("Unexpected token standard in metadata.");

  const collectionOption = bytes[offset++] ?? 0;
  if (collectionOption === 1) {
    // A verified collection must never be silently removed by a metadata URI update.
    throw new Error("This token has a collection. Metadata update requires a collection-preserving flow.");
  }
  if (collectionOption !== 0) throw new Error("Unexpected collection option in metadata.");

  const usesOption = bytes[offset++] ?? 0;
  if (usesOption === 1) {
    throw new Error("This token has uses data. Metadata update requires a uses-preserving flow.");
  }
  if (usesOption !== 0) throw new Error("Unexpected uses option in metadata.");

  return {
    updateAuthority, mint,
    name: name.value, symbol: symbol.value, uri: uri.value,
    sellerFeeBasisPoints, creators, primarySaleHappened,
    isMutable, tokenStandard,
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
  // Metaplex UpdateMetadataAccountV2 (discriminator 15), using DataV2.
  // Only name, symbol and URI change. Preserve existing seller fee and creators.
  // Null collection/uses are guarded by the metadata decoder above.
  const dataV2 = concat([
    borshString(TARGET_NAME),
    borshString(TARGET_SYMBOL),
    borshString(TARGET_URI),
    u16(current.sellerFeeBasisPoints),
    encodeCreators(current.creators),
    new Uint8Array([0]), // DataV2.collection = None
    new Uint8Array([0]), // DataV2.uses = None
  ]);

  const instructionData = concat([
    new Uint8Array([15]), // UpdateMetadataAccountV2
    new Uint8Array([1]),  // data: Some(DataV2)
    dataV2,
    new Uint8Array([0]),  // new update authority: None (preserve)
    new Uint8Array([0]),  // primary sale happened: None (preserve)
    new Uint8Array([0]),  // is mutable: None (preserve)
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
  const [preflightStatus, setPreflightStatus] = useState("");
  const [preflightLogs, setPreflightLogs] = useState("");
  const [txSignature, setTxSignature] = useState("");

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
      if (!account.owner.equals(METADATA_PROGRAM)) throw new Error("Unexpected metadata program owner.");
      const decoded = decodeMetadata(new Uint8Array(account.data));
      if (decoded.mint !== TIX_MINT.toBase58()) throw new Error("Token mint does not match TIX.");
      setMetadataPda(pda);
      setCurrent(decoded);
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
    if (!publicKey || !metadataPda || !current || working || alreadyUpdated) return;
    if (!isAuthority) {
      setMessage("Connect the wallet shown as the on-chain update authority.");
      return;
    }
    if (!current.isMutable || current.mint !== TIX_MINT.toBase58()) {
      setMessage("Update refused: incorrect or immutable token metadata.");
      return;
    }

    setWorking(true);
    setMessage("");
    setPreflightLogs("");
    setPreflightStatus("checking");
    setTxSignature("");

    let simulationPassed = false;
    try {
      // Reload the authority, mint and mutable flag immediately before signing.
      const account = await connection.getAccountInfo(metadataPda, "confirmed");
      if (!account?.data || !account.owner.equals(METADATA_PROGRAM)) {
        throw new Error("TIX metadata account could not be verified.");
      }
      const fresh = decodeMetadata(new Uint8Array(account.data));
      if (fresh.mint !== TIX_MINT.toBase58() || !fresh.isMutable) {
        throw new Error("The TIX metadata account is no longer mutable or is for a different mint.");
      }
      if (fresh.updateAuthority !== publicKey.toBase58()) {
        throw new Error("The connected wallet is no longer the update authority.");
      }
      if (fresh.name === TARGET_NAME && fresh.symbol === TARGET_SYMBOL && fresh.uri === TARGET_URI) {
        setCurrent(fresh);
        setMessage("TIX metadata already matches the target. No transaction needed.");
        setPreflightStatus("not needed");
        return;
      }

      const tx = new Transaction().add(updateMetadataInstruction(metadataPda, publicKey, fresh));
      tx.feePayer = publicKey;
      const latest = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = latest.blockhash;

      // An unsigned, read-only simulation is required before any wallet approval.
      // Never offer an "unsafe continue" override for failed simulations.
      // web3.js v1 has two simulateTransaction overloads:
      // (legacy Transaction, optional Signer[]), or
      // (VersionedTransaction, optional SimulateTransactionConfig).
      // Passing an RPC config object as the second argument for a legacy
      // Transaction throws "Invalid arguments" before hitting Solana RPC.
      // This legacy overload runs an unsigned simulation when no signers
      // are supplied; the transaction's recent blockhash is already set.
      const simulation = await connection.simulateTransaction(tx);
      setPreflightLogs((simulation.value?.logs || []).join("\n"));
      if (!simulation.value || simulation.value.err) {
        setPreflightStatus("failed");
        throw new Error(
          "On-chain preflight failed: " +
          JSON.stringify(simulation.value?.err ?? "No simulation result") +
          ". No wallet signature was requested."
        );
      }
      simulationPassed = true;
      setPreflightStatus("passed");
      setMessage("Simulation passed. Review the wallet request carefully before signing.");

      const signature = await sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      setTxSignature(signature);
      setMessage("Transaction submitted. Waiting for Solana confirmation…");

      const confirmed = await connection.confirmTransaction(
        { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
        "confirmed"
      );
      if (confirmed.value?.err) {
        throw new Error("On-chain transaction failed: " + JSON.stringify(confirmed.value.err));
      }

      const updatedAccount = await connection.getAccountInfo(metadataPda, "confirmed");
      if (!updatedAccount?.data) throw new Error("Confirmed, but could not re-read TIX metadata.");
      const updated = decodeMetadata(new Uint8Array(updatedAccount.data));
      setCurrent(updated);
      const matches = updated.name === TARGET_NAME && updated.symbol === TARGET_SYMBOL &&
        updated.uri === TARGET_URI;
      if (!matches) {
        throw new Error("Transaction confirmed, but the on-chain metadata still does not match. Review the transaction before retrying.");
      }
      setMessage("Confirmed on Solana: TIX metadata matches the new MoonTicket name, symbol and URI.");
    } catch (err) {
      console.error("TIX metadata update failed:", err);
      if (!simulationPassed) setPreflightStatus("failed");
      setMessage(err?.message || "TIX metadata update failed. Do not bypass wallet warnings.");
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
                <p><strong>Mutable:</strong> {current.isMutable ? "Yes" : "No"}</p>
                <p><strong>Token standard:</strong> {current.tokenStandard ?? "Not set"}</p>
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
                  disabled={!isAuthority || working || !current.isMutable}
                  className="mt-5 bg-yellow-400 text-black font-bold rounded-lg px-6 py-3 disabled:opacity-40"
                >
                  {working ? "Checking and updating…" : "Simulate & Update TIX Metadata"}
                </button>
              )}
            </section>
          </>
        ) : null}

        {preflightStatus && (
          <p className="mt-6 text-sm">
            <strong>Preflight:</strong> {preflightStatus}
          </p>
        )}
        {message && <p role="status" className="mt-3 break-all">{message}</p>}
        {txSignature && (
          <p className="mt-3 break-all text-sm">
            <a className="underline" href={`https://solscan.io/tx/${txSignature}`}
              target="_blank" rel="noopener noreferrer">
              View on-chain transaction on Solscan
            </a>
          </p>
        )}
        {preflightLogs && (
          <details className="mt-4 rounded border border-yellow-400/30 p-3">
            <summary className="cursor-pointer text-sm">Solana simulation logs</summary>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{preflightLogs}</pre>
          </details>
        )}
        <p className="mt-6 text-sm text-yellow-100/80">
          Only approve a metadata-only transaction that you understand.
          If Phantom warns that the request is unsafe, cancel it and inspect the simulation logs.
          Never approve an unsafe transaction just to update the token description.
        </p>

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
