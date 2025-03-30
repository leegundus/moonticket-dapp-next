import "@/styles/globals.css";
import dynamic from "next/dynamic";
import Navbar from "../components/Navbar";
import dynamicWalletProvider from "../wallet/WalletProvider";

export default function App({ Component, pageProps }) {
  return dynamicWalletProvider(
    <>
      <Navbar />
      <Component {...pageProps} />
    </>
  );
}
