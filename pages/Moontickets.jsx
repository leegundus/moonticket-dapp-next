import dynamic from "next/dynamic";
const Moontickets = dynamic(()=>import("../components/Moontickets"), { ssr:false });

export default function Page() {
  // Pull in your wallet + price hooks here (publicKey, tixPriceUSD, tixBalance)
  // and pass as props to <Moontickets />
  return <Moontickets /* publicKey={...} tixPriceUSD={...} tixBalance={...} onRefresh={...} */ />;
}
