import Script from "next/script";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

const TIX_MINT = "8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export default function BuyTix() {
  const wallet = useWallet();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || typeof window === "undefined" || !window.Jupiter) return;

    try {
      window.Jupiter.init({
        displayMode: "integrated",
        integratedTargetId: "jupiter-plugin",
        formProps: {
          initialInputMint: SOL_MINT,
          initialOutputMint: TIX_MINT,
          fixedMint: TIX_MINT,
        },
        enableWalletPassthrough: true,
        passthroughWalletContextState: wallet,
        onRequestConnectWallet: () => window.dispatchEvent(new Event("moonticket:connect-wallet")),
        defaultExplorer: "Solscan",
        onSwapError: ({ error: swapError }) => {
          console.error("Jupiter swap error:", swapError);
          setError("Jupiter could not complete that swap. Check available liquidity and try again.");
        },
        onSuccess: () => setError(""),
      });
    } catch (err) {
      console.error("Jupiter init error:", err);
      setError("The TIX swap interface could not load.");
    }

    return () => {
      try { window.Jupiter?.close?.(); } catch {}
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || typeof window === "undefined" || !window.Jupiter?.syncProps) return;
    try {
      window.Jupiter.syncProps({ passthroughWalletContextState: wallet });
    } catch {}
  }, [ready, wallet.connected, wallet.publicKey]);

  return (
    <div className="min-h-screen bg-black text-yellow-400 px-4 pt-40 pb-20">
      <Script
        src="https://plugin.jup.ag/plugin-v1.js"
        strategy="afterInteractive"
        data-preload
        onLoad={() => setReady(true)}
        onError={() => setError("The Jupiter swap interface could not load.")}
      />

      <main className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-center">Buy TIX</h1>
        <p className="text-center mt-4 max-w-2xl mx-auto leading-relaxed">
          TIX is MoonTicket&apos;s token on the Solana blockchain. TIX may be included
          in weekly prize bundles alongside SOL, NFTs, and other crypto assets.
          Buying or holding TIX is optional and does not increase drawing odds.
        </p>
        <p className="text-center mt-3 max-w-2xl mx-auto leading-relaxed">
          Swap SOL or another supported Solana token for TIX through Jupiter, subject
          to available liquidity and network fees. MoonTicket does not sell TIX directly.
        </p>
        <p className="mt-3 text-center text-sm">
          <a href="/whitepaper" className="underline">Learn about MoonTicket and TIX</a>
        </p>

        <div className="mt-8 border border-yellow-400/30 rounded-xl p-3 bg-black">
          <div id="jupiter-plugin" className="min-h-[560px]" />
        </div>

        {!ready && !error && <p className="text-center mt-4">Loading Jupiter…</p>}
        {error && <p className="text-center mt-4 text-red-400">{error}</p>}

        <div className="mt-8 text-center text-xs opacity-80 break-all">
          TIX Mint: {TIX_MINT}
        </div>
        <p className="text-center text-xs opacity-70 mt-3">
          Swaps are routed by Jupiter and depend on available on-chain liquidity.
        </p>
      </main>
    </div>
  );
}
