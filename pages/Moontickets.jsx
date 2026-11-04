import dynamic from "next/dynamic";

const WeeklyDraw = dynamic(() => import("../components/Moontickets"), {
  ssr: false,
});

export default function Page() {
  return (
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center pt-40 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-6xl font-bold tracking-wide">MoonTicket</h1>
        <p className="mt-2 text-sm md:text-base text-yellow-300">Weekly Prize Drawing</p>
      </div>
      <WeeklyDraw />
    </div>
  );
}
