import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

require("@solana/wallet-adapter-react-ui/styles.css");

const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

// Phantom's mobile extension is injected only in Phantom's in-app browser.
// External iOS/Android browsers cannot directly connect to that extension.
// These official "browse" links hand the user to each wallet's in-app browser,
// where the existing Solana Wallet Adapter handles the actual connection.
const MOBILE_WALLETS = [
  { name: "Phantom", browse: "https://phantom.com/ul/browse/" },
  { name: "Solflare", browse: "https://solflare.com/ul/v1/browse/" },
  { name: "Backpack", browse: "https://backpack.app/ul/v1/browse/" },
];

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function currentPublicPage() {
  if (typeof window === "undefined") return "https://www.moonticket.io/";
  // Keep the current route, but avoid forwarding query strings or URL fragments
  // (which could contain temporary credentials) to an external wallet service.
  return window.location.origin + window.location.pathname;
}

export default function WalletConnect() {
  const { connected, connecting, disconnect, select, wallets } = useWallet();
  const { setVisible } = useWalletModal();
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePromptOpen, setMobilePromptOpen] = useState(false);
  const [pageUrl, setPageUrl] = useState("https://www.moonticket.io/");
  const [connectTimedOut, setConnectTimedOut] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    setPageUrl(currentPublicPage());
  }, []);

  // Wallet Standard auto-discovers injected wallets in Phantom/Solflare/
  // Backpack's own browsers; do not interrupt those connections.
  const injectedWallet =
    typeof window !== "undefined" &&
    Boolean(
      window.phantom?.solana?.isPhantom ||
      window.solana?.isPhantom ||
      window.solflare?.isSolflare ||
      window.backpack?.solana
    );
  const availableWallet = wallets?.some((wallet) => wallet.readyState === "Installed");
  const needsMobileHandoff = isMobile && !connected && !injectedWallet && !availableWallet;

  const requestConnection = useCallback(() => {
    if (needsMobileHandoff) {
      setPageUrl(currentPublicPage());
      setMobilePromptOpen(true);
    } else {
      setVisible(true);
    }
  }, [needsMobileHandoff, setVisible]);

  // The embedded Jupiter buy widget uses this same connection entry point,
  // so external mobile browsers get a useful choice instead of an unusable
  // wallet-adapter modal.
  useEffect(() => {
    window.addEventListener("moonticket:connect-wallet", requestConnection);
    return () => window.removeEventListener("moonticket:connect-wallet", requestConnection);
  }, [requestConnection]);

  useEffect(() => {
    if (connected || !needsMobileHandoff) setMobilePromptOpen(false);
    if (connected) setConnectTimedOut(false);
  }, [connected, needsMobileHandoff]);

  // Never leave the UI stuck on "Connecting…" forever. If a wallet does not
  // answer, reset Wallet Adapter so the user can choose/retry cleanly.
  useEffect(() => {
    if (!connecting) return undefined;

    const timer = window.setTimeout(async () => {
      try { await disconnect(); } catch {}
      try { select(null); } catch {}
      setConnectTimedOut(true);
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [connecting, disconnect, select]);

  const origin = (() => {
    try { return new URL(pageUrl).origin; }
    catch { return "https://www.moonticket.io"; }
  })();
  const browseLink = (browse) =>
    browse + encodeURIComponent(pageUrl) + "?ref=" + encodeURIComponent(origin);

  return (
    <>
      <div className="my-2 shrink-0">
        {needsMobileHandoff ? (
          <button
            type="button"
            onClick={requestConnection}
            className="rounded bg-yellow-400 px-3 py-2 text-xs font-semibold text-black hover:bg-yellow-300 sm:px-4 sm:text-sm"
          >
            Connect Wallet
          </button>
        ) : connectTimedOut && !connected ? (
          <button
            type="button"
            onClick={() => {
              setConnectTimedOut(false);
              setVisible(true);
            }}
            className="rounded bg-yellow-400 px-3 py-2 text-xs font-semibold text-black hover:bg-yellow-300 sm:px-4 sm:text-sm"
          >
            Retry Wallet
          </button>
        ) : (
          <WalletMultiButton className="!bg-yellow-400 !text-black !font-semibold !px-3 sm:!px-4 !py-2 !rounded hover:!bg-yellow-300 transition" />
        )}
      </div>

      {mobilePromptOpen && needsMobileHandoff && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/85 px-4 py-8"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Connect a Solana wallet on mobile"
            className="w-full max-w-sm rounded-xl border border-yellow-400/50 bg-zinc-950 p-5 text-yellow-400 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold">Connect a wallet</h2>
              <button
                type="button"
                onClick={() => setMobilePromptOpen(false)}
                aria-label="Close wallet choices"
                className="rounded px-2 text-2xl leading-none text-yellow-300"
              >
                ×
              </button>
            </div>

            <p className="mt-3 text-sm text-yellow-100">
              Choose your wallet to open MoonTicket inside its in-app browser.
              Then tap Connect Wallet again and approve the wallet connection.
            </p>

            <div className="mt-5 flex flex-col gap-3">
              {MOBILE_WALLETS.map((wallet) => (
                <a
                  key={wallet.name}
                  href={browseLink(wallet.browse)}
                  className="block rounded-lg bg-yellow-400 px-4 py-3 text-center font-semibold text-black hover:bg-yellow-300"
                >
                  Open in {wallet.name}
                </a>
              ))}
            </div>

            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-yellow-400/60 px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setMobilePromptOpen(false);
                setVisible(true);
              }}
            >
              Other wallet options
            </button>

            <p className="mt-4 text-xs leading-relaxed text-yellow-100/80">
              If your wallet does not open, launch its app and enter
              www.moonticket.io in its built-in browser. Connecting does not require transferring funds. Only approve requests you recognize.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
