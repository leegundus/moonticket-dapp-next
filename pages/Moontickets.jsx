import dynamic from "next/dynamic";

const Moontickets = dynamic(() => import("../components/Moontickets"), {
  ssr: false,
});

export default function Page() {
  return (
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center pt-40 px-4">
      {/* Banner */}
      <img
        src="/Moontickets-banner.png"
        alt="Moonticket Banner"
        className="w-72 md:w-[28rem] lg:w-[36rem] mx-auto mb-2"
      />

      {/* Render the Moontickets component */}
      <Moontickets />
    </div>
  );
}
