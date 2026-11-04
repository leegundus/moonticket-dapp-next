import dynamic from "next/dynamic";
import MoonTicketBanner from "../components/MoonTicketBanner";

const WeeklyDraw = dynamic(() => import("../components/Moontickets"), {
  ssr: false,
});

export default function Page() {
  return (
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center pt-40 px-4">
      <MoonTicketBanner className="mb-2" />
      <p className="mb-8 text-sm md:text-base text-yellow-300">Weekly Prize Drawing</p>
      <WeeklyDraw />
    </div>
  );
}
