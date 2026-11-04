import "../styles/globals.css";
import Script from "next/script";
import WalletProvider from "../wallet/WalletProvider";
import Navbar from "../components/Navbar";

function MyApp({ Component, pageProps }) {
  return WalletProvider(
    <>
      <Script
        id="jupiter-plugin-script"
        src="https://plugin.jup.ag/plugin-v1.js"
        strategy="beforeInteractive"
        data-preload
        defer
      />
      <Navbar />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
