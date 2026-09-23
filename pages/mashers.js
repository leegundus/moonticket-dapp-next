import Head from "next/head";
import { useState } from "react";
import { BrowserProvider, Contract, getAddress, isAddress } from "ethers";

const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_MAINNET_CHAIN_ID = 8453;
const MINT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_MASHERS_CHAIN_ID || BASE_SEPOLIA_CHAIN_ID
);

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MASHERS_CONTRACT || "";
const USDC_ADDRESS =
  process.env.NEXT_PUBLIC_MASHERS_USDC_ADDRESS ||
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const TEST_PARENT_A = process.env.NEXT_PUBLIC_MASHERS_TEST_PARENT_A || "";
const TEST_PARENT_B = process.env.NEXT_PUBLIC_MASHERS_TEST_PARENT_B || "";

const FIVE_USDC = 5000000n;

const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
];

const MASHERS_ABI = [
  "function createMasher((address creator,uint256 parentAChainId,address parentACollection,uint256 parentATokenId,uint256 parentBChainId,address parentBCollection,uint256 parentBTokenId,bytes32 tokenURIHash,uint256 deadline) voucher,string tokenURI,bytes signature) returns (uint256)",
];

const SOURCE_CHAINS = [
  { id: 84532, label: "Base Sepolia (test)" },
  { id: 8453, label: "Base" },
  { id: 1, label: "Ethereum" },
];

function shortAddress(value) {
  if (!value) return "";
  return value.slice(0, 6) + "…" + value.slice(-4);
}

function mintNetworkParams() {
  if (MINT_CHAIN_ID === BASE_MAINNET_CHAIN_ID) {
    return {
      chainId: "0x2105",
      chainName: "Base",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://mainnet.base.org"],
      blockExplorerUrls: ["https://basescan.org"],
    };
  }

  return {
    chainId: "0x14a34",
    chainName: "Base Sepolia",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia.basescan.org"],
  };
}

async function switchToMintChain() {
  if (!window.ethereum) {
    throw new Error(
      "Install an EVM wallet such as Coinbase Wallet or MetaMask"
    );
  }

  const params = mintNetworkParams();

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: params.chainId }],
    });
  } catch (error) {
    if (error && error.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [params],
      });
      return;
    }
    throw error;
  }
}

function SourceCard({ label, value, onChange }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{label}</h3>
        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
          Source NFT
        </span>
      </div>

      <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
        Chain
      </label>
      <select
        value={value.chainId}
        onChange={(event) =>
          onChange({ ...value, chainId: Number(event.target.value) })
        }
        className="mb-4 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white"
      >
        {SOURCE_CHAINS.map((chain) => (
          <option key={chain.id} value={chain.id}>
            {chain.label}
          </option>
        ))}
      </select>

      <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
        Collection contract
      </label>
      <input
        value={value.collection}
        onChange={(event) =>
          onChange({ ...value, collection: event.target.value.trim() })
        }
        placeholder="0x..."
        className="mb-4 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-cyan-400/60"
      />

      <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
        Token ID
      </label>
      <input
        value={value.tokenId}
        onChange={(event) =>
          onChange({
            ...value,
            tokenId: event.target.value.replace(/[^0-9]/g, ""),
          })
        }
        inputMode="numeric"
        placeholder="1"
        className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-cyan-400/60"
      />
    </div>
  );
}

export default function MashersPage() {
  const [account, setAccount] = useState("");
  const [parentA, setParentA] = useState({
    chainId: BASE_SEPOLIA_CHAIN_ID,
    collection: TEST_PARENT_A,
    tokenId: "1",
  });
  const [parentB, setParentB] = useState({
    chainId: BASE_SEPOLIA_CHAIN_ID,
    collection: TEST_PARENT_B,
    tokenId: "1",
  });
  const [authorization, setAuthorization] = useState(null);
  const [status, setStatus] = useState(
    "Ready for Base Sepolia contract setup."
  );
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState("");

  const configured =
    isAddress(CONTRACT_ADDRESS || "") && isAddress(USDC_ADDRESS || "");

  async function connect() {
    try {
      setBusy(true);

      if (!window.ethereum) {
        throw new Error(
          "Install an EVM wallet such as Coinbase Wallet or MetaMask"
        );
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const nextAccount = getAddress(accounts[0]);

      await switchToMintChain();

      setAccount(nextAccount);
      setStatus(
        "Connected " +
          shortAddress(nextAccount) +
          " on the Mashers mint network."
      );
    } catch (error) {
      setStatus(
        (error && (error.shortMessage || error.message)) ||
          "Wallet connection failed"
      );
    } finally {
      setBusy(false);
    }
  }

  function validateSources() {
    if (!account) throw new Error("Connect your Base wallet first");
    if (!isAddress(parentA.collection || "")) {
      throw new Error("Parent A collection address is invalid");
    }
    if (!isAddress(parentB.collection || "")) {
      throw new Error("Parent B collection address is invalid");
    }
    if (!parentA.tokenId || !parentB.tokenId) {
      throw new Error("Enter both token IDs");
    }
  }

  async function generateTestMasher() {
    try {
      setBusy(true);
      setTxHash("");
      setAuthorization(null);
      validateSources();

      setStatus("Verifying ownership of both source NFTs...");

      const response = await fetch("/api/mashers/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator: account,
          parentA,
          parentB,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data && data.error ? data.error : "Authorization failed");
      }

      setAuthorization(data);
      setStatus(
        "Ownership verified. Test Masher authorized for minting."
      );
    } catch (error) {
      setStatus(
        (error && (error.shortMessage || error.message)) ||
          "Could not create test Masher"
      );
    } finally {
      setBusy(false);
    }
  }

  async function approveUSDC() {
    try {
      setBusy(true);
      validateSources();

      if (!configured) {
        throw new Error("Mashers contract is not configured yet");
      }

      await switchToMintChain();

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

      setStatus("Approving exactly 5 USDC for one Masher...");

      const tx = await usdc.approve(CONTRACT_ADDRESS, FIVE_USDC);
      setTxHash(tx.hash);
      await tx.wait();

      setStatus("5 USDC approved. You can now mint this Masher.");
    } catch (error) {
      setStatus(
        (error && (error.shortMessage || error.message)) ||
          "USDC approval failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function mintMasher() {
    try {
      setBusy(true);

      if (!authorization) {
        throw new Error("Generate and authorize the Masher first");
      }
      if (!configured) {
        throw new Error("Mashers contract is not configured yet");
      }

      await switchToMintChain();

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const mashers = new Contract(CONTRACT_ADDRESS, MASHERS_ABI, signer);

      setStatus("Minting Masher on Base...");

      const tx = await mashers.createMasher(
        authorization.voucher,
        authorization.tokenURI,
        authorization.signature
      );
      setTxHash(tx.hash);
      await tx.wait();

      setStatus(
        "Masher minted. The $5 creation fee was split $3 / $1 / $1 on-chain."
      );
    } catch (error) {
      setStatus(
        (error && (error.shortMessage || error.message)) ||
          "Masher mint failed"
      );
    } finally {
      setBusy(false);
    }
  }

  const explorerBase =
    MINT_CHAIN_ID === BASE_MAINNET_CHAIN_ID
      ? "https://basescan.org/tx/"
      : "https://sepolia.basescan.org/tx/";

  return (
    <>
      <Head>
        <title>Mashers Lab | MoonTicket</title>
        <meta
          name="description"
          content="Mash two approved NFTs into a new Base NFT."
        />
      </Head>

      <main className="min-h-screen bg-[#050711] px-4 pb-20 pt-36 text-slate-100">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-violet-500/15 via-slate-950 to-cyan-400/10 p-7 md:p-10">
            <div className="mb-4 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
              Base Sepolia Prototype
            </div>

            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">
              Pick two NFTs. Make one{" "}
              <span className="text-cyan-300">Masher.</span>
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 md:text-lg">
              The prototype verifies that you own both source NFTs, creates a
              test fusion, charges 5 USDC, and mints a new ERC-721 on Base.
              Final artwork generation will replace the temporary test graphic
              after the on-chain flow is proven.
            </p>

            <div className="mt-7 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-slate-400">Creation fee</div>
                <div className="mt-1 text-xl font-bold text-white">$5 USDC</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-slate-400">Creation split</div>
                <div className="mt-1 text-xl font-bold text-white">
                  $3 / $1 / $1
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-slate-400">Resale royalty signal</div>
                <div className="mt-1 text-xl font-bold text-white">
                  8% · 2% each
                </div>
              </div>
            </div>
          </div>

          {!configured && (
            <div className="mb-6 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
              The page is installed, but the Base Sepolia contract address has
              not been added to the site environment yet. After deployment we
              will set{" "}
              <span className="font-mono">
                NEXT_PUBLIC_MASHERS_CONTRACT
              </span>
              .
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-7">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Masher Builder
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    First test: use the two mock Base Sepolia NFT collections
                    deployed with the contract.
                  </p>
                </div>

                <button
                  onClick={connect}
                  disabled={busy}
                  className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
                >
                  {account
                    ? shortAddress(account)
                    : "Connect Base Wallet"}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <SourceCard
                  label="Parent A"
                  value={parentA}
                  onChange={setParentA}
                />
                <SourceCard
                  label="Parent B"
                  value={parentB}
                  onChange={setParentB}
                />
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  Status
                </div>
                <div className="text-sm leading-6 text-slate-200">
                  {status}
                </div>
                {txHash && (
                  <a
                    href={explorerBase + txHash}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                  >
                    View transaction ↗
                  </a>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <button
                  onClick={generateTestMasher}
                  disabled={busy || !account}
                  className="rounded-xl bg-violet-500 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  1. Generate test Masher
                </button>
                <button
                  onClick={approveUSDC}
                  disabled={
                    busy || !account || !authorization || !configured
                  }
                  className="rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-4 py-3 font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  2. Approve $5 USDC
                </button>
                <button
                  onClick={mintMasher}
                  disabled={busy || !authorization || !configured}
                  className="rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  3. Mint Masher
                </button>
              </div>
            </section>

            <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-7">
              <h2 className="text-2xl font-bold text-white">Preview</h2>

              <div className="mt-5 aspect-square overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                {authorization && authorization.previewImage ? (
                  <img
                    src={authorization.previewImage}
                    alt="Masher test preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-8 text-center text-sm leading-6 text-slate-500">
                    Your temporary test fusion will appear here after both
                    source NFTs are verified.
                  </div>
                )}
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-xl border border-white/10 p-4">
                  <div className="text-slate-500">Mint chain</div>
                  <div className="mt-1 font-semibold text-white">
                    {MINT_CHAIN_ID === BASE_MAINNET_CHAIN_ID
                      ? "Base"
                      : "Base Sepolia"}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 p-4">
                  <div className="text-slate-500">Contract</div>
                  <div className="mt-1 break-all font-mono text-xs text-slate-200">
                    {configured ? CONTRACT_ADDRESS : "Not deployed yet"}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 p-4 text-slate-300">
                  One exact parent pair can create only one official Masher.
                  Reversing A and B does not create a second combination.
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm leading-6 text-slate-400">
            <strong className="text-white">Prototype scope:</strong> the test
            graphic is intentionally simple. Production will retrieve approved
            source assets, generate the fusion artwork, store permanent
            metadata, and only then issue the signed mint voucher. ERC-2981 is
            included for the 8% resale royalty signal; marketplace enforcement
            is a separate production decision.
          </div>
        </div>
      </main>
    </>
  );
}
