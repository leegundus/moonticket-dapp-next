import dynamic from "next/dynamic";
const Moontickets = dynamic(()=>import("../components/Moontickets"), { ssr:false });

export default function Page() {
  <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center justify-start py-10 space-y-8 pt-40">
      {/* Logo */}
      <img
        src="/moontickets-banner.png"
        alt="Moonticket Banner"
        className="w-72 md:w-[28rem] lg:w-[36rem] mx-auto"
      />

  // Pull in your wallet + price hooks here (publicKey, tixPriceUSD, tixBalance)
  // and pass as props to <Moontickets />
  return <Moontickets /* publicKey={...} tixPriceUSD={...} tixBalance={...} onRefresh={...} */ />;
}
