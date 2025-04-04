import "../styles/globals.css";
import WalletProvider from "../wallet/WalletProvider";
import Navbar from "../components/Navbar";

function MyApp({ Component, pageProps }) {
  return WalletProvider(
    <>
      <Navbar />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
