import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

const OWNER = "FrAvtjXo5JCsWrjcphvWCGQDrXX8PuEbN2qu2SGdvurG";

function messageFor(action, timestamp, payload) {
  return [
    "MoonTicket Admin",
    "Action: " + action,
    "Timestamp: " + timestamp,
    "Payload: " + JSON.stringify(payload || {}),
  ].join("\n");
}

function toBase64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export default function AdminPage() {
  const { publicKey, signMessage } = useWallet();
  const [draws, setDraws] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [tix, setTix] = useState("");
  const [sol, setSol] = useState("");
  const [nftName, setNftName] = useState("");
  const [nftMint, setNftMint] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenMint, setTokenMint] = useState("");
  const [payoutSigs, setPayoutSigs] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const wallet = publicKey?.toBase58();
  const isOwner = wallet === OWNER;
  const selected = useMemo(() => draws.find((d) => d.draw_key === selectedKey) || null, [draws, selectedKey]);

  async function load() {
    try {
      const res = await fetch("/api/admin/draws");
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setDraws(items);
      if (!selectedKey && items.length) setSelectedKey(items[0].draw_key || "");
    } catch {
      setMessage("Could not load drawings.");
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const bundle = Array.isArray(selected?.prize_bundle) ? selected.prize_bundle : [];
    const t = bundle.find((x) => x.type === "TIX");
    const s = bundle.find((x) => x.type === "SOL");
    const n = bundle.find((x) => x.type === "NFT");
    const tok = bundle.find((x) => x.type === "TOKEN");
    setTix(t?.amount || "");
    setSol(s?.amount || "");
    setNftName(n?.label || "");
    setNftMint(n?.mint || "");
    setTokenName(tok?.label || "");
    setTokenAmount(tok?.amount || "");
    setTokenMint(tok?.mint || "");
  }, [selectedKey]);

  async function signedPost(endpoint, action, payload) {
    if (!isOwner) throw new Error("Connect the MoonTicket owner wallet.");
    if (!signMessage) throw new Error("This wallet does not support message signing.");

    const timestamp = Date.now();
    const bytes = new TextEncoder().encode(messageFor(action, timestamp, payload));
    const signature = await signMessage(bytes);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        timestamp,
        payload,
        signature: toBase64(signature),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Action failed.");
    return data;
  }

  async function run(fn) {
    setWorking(true);
    setMessage("");
    try {
      const result = await fn();
      setMessage(result?.message || "Saved.");
      await load();
    } catch (err) {
      setMessage(err?.message || "Action failed.");
    } finally {
      setWorking(false);
    }
  }

  function prizeItems() {
    const items = [];
    if (tix.trim()) items.push({ type: "TIX", label: "TIX", amount: tix.trim() });
    if (sol.trim()) items.push({ type: "SOL", label: "SOL", amount: sol.trim() });
    if (nftName.trim() || nftMint.trim()) items.push({ type: "NFT", label: nftName.trim() || "NFT", mint: nftMint.trim() });
    if (tokenName.trim() || tokenAmount.trim() || tokenMint.trim()) {
      items.push({
        type: "TOKEN",
        label: tokenName.trim() || "Bonus Token",
        amount: tokenAmount.trim(),
        mint: tokenMint.trim(),
      });
    }
    return items;
  }

  if (!publicKey) {
    return <div className="min-h-screen bg-black text-yellow-400 pt-40 px-6 text-center">Connect the owner wallet to manage MoonTicket.</div>;
  }

  if (!isOwner) {
    return <div className="min-h-screen bg-black text-yellow-400 pt-40 px-6 text-center">This page is only available to the MoonTicket owner wallet.</div>;
  }

  return (
    <div className="min-h-screen bg-black text-yellow-400 pt-36 pb-20 px-4">
      <main className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold">MoonTicket Admin</h1>
        <p className="mt-2 text-sm opacity-80">Owner actions require a wallet signature. Your private key never leaves your wallet.</p>

        <div className="mt-8">
          <label className="block text-sm mb-2">Drawing</label>
          <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}
            className="w-full bg-black border border-yellow-400 rounded p-3">
            {draws.map((d) => (
              <option key={d.id} value={d.draw_key}>{d.draw_key} — {d.status}</option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="mt-4 text-sm border border-yellow-400/30 rounded p-4">
            <div>Status: <strong>{selected.status}</strong></div>
            <div>Winner: <span className="break-all">{selected.winner || "Not selected"}</span></div>
            <div>Entries: {selected.entries ?? "—"}</div>
          </div>
        )}

        <section className="mt-8 border border-yellow-400/30 rounded-xl p-5">
          <h2 className="text-xl font-bold">Prize Bundle</h2>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <input value={tix} onChange={(e) => setTix(e.target.value)} placeholder="TIX amount"
              className="bg-black border border-yellow-400/40 rounded p-3" />
            <input value={sol} onChange={(e) => setSol(e.target.value)} placeholder="Optional SOL amount"
              className="bg-black border border-yellow-400/40 rounded p-3" />
            <input value={nftName} onChange={(e) => setNftName(e.target.value)} placeholder="Optional NFT name"
              className="bg-black border border-yellow-400/40 rounded p-3" />
            <input value={nftMint} onChange={(e) => setNftMint(e.target.value)} placeholder="NFT mint/address"
              className="bg-black border border-yellow-400/40 rounded p-3" />
            <input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="Optional token name"
              className="bg-black border border-yellow-400/40 rounded p-3" />
            <input value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} placeholder="Token amount"
              className="bg-black border border-yellow-400/40 rounded p-3" />
            <input value={tokenMint} onChange={(e) => setTokenMint(e.target.value)} placeholder="Token mint"
              className="md:col-span-2 bg-black border border-yellow-400/40 rounded p-3" />
          </div>
          <button disabled={working || !selectedKey}
            onClick={() => run(async () => {
              const data = await signedPost("/api/admin/setPrize", "set_prize", { drawKey: selectedKey, items: prizeItems() });
              return { message: "Prize bundle saved." };
            })}
            className="mt-5 bg-yellow-400 text-black font-bold rounded px-5 py-3 disabled:opacity-40">
            Save Prize Bundle
          </button>
        </section>

        <section className="mt-8 border border-yellow-400/30 rounded-xl p-5">
          <h2 className="text-xl font-bold">Run Drawing</h2>
          <p className="text-sm mt-2 opacity-80">
            After Monday 10 PM CT, Prepare locks the eligible list and commits to a future Solana slot.
            Finalize uses that finalized blockhash to select one winner.
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <button disabled={working || !selectedKey}
              onClick={() => run(() => signedPost("/api/admin/prepareDraw", "prepare_draw", { drawKey: selectedKey }))}
              className="border border-yellow-400 rounded px-5 py-3 disabled:opacity-40">
              Prepare Drawing
            </button>
            <button disabled={working || !selectedKey}
              onClick={() => run(() => signedPost("/api/admin/finalizeDraw", "finalize_draw", { drawKey: selectedKey }))}
              className="bg-yellow-400 text-black font-bold rounded px-5 py-3 disabled:opacity-40">
              Finalize Winner
            </button>
          </div>
        </section>

        <section className="mt-8 border border-yellow-400/30 rounded-xl p-5">
          <h2 className="text-xl font-bold">Record Payout</h2>
          <p className="text-sm mt-2 opacity-80">Send the prize from your wallet, then paste the Solana transaction signature(s) here.</p>
          <textarea value={payoutSigs} onChange={(e) => setPayoutSigs(e.target.value)}
            placeholder="One or more transaction signatures, separated by commas or new lines"
            className="w-full h-28 mt-4 bg-black border border-yellow-400/40 rounded p-3" />
          <button disabled={working || !selectedKey}
            onClick={() => run(async () => {
              const signatures = payoutSigs.split(/[\n,]+/).map((v) => v.trim()).filter(Boolean);
              await signedPost("/api/admin/recordPayout", "record_payout", { drawKey: selectedKey, signatures });
              return { message: "Payout recorded and published." };
            })}
            className="mt-4 border border-yellow-400 rounded px-5 py-3 disabled:opacity-40">
            Publish Payout
          </button>
        </section>

        {message && <p className="mt-6 text-center">{message}</p>}
      </main>
    </div>
  );
}
