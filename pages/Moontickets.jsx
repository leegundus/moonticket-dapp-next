import dynamic from "next/dynamic";
const Moontickets = dynamic(()=>import("../components/Moontickets"), { ssr:false });

export default function Page() {
  return (
    <div className="min-h-screen bg-black text-yellow-400>
      <div className="mx-auto max-w-5x1 px-4 pt-40 pb-10">
        {/* Logo */}
        <img
          src="/moontickets-banner.png"
          alt="Moonticket Banner"
          className="w-72 md:w-[28rem] lg:w-[36rem] mx-auto"
        />

        <Moontickets />
      </div>
    </div>
   );
}
