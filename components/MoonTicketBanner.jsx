export default function MoonTicketBanner({ className = "" }) {
  return (
    <div
      className={`w-full max-w-[900px] overflow-hidden mx-auto ${className}`}
      style={{ aspectRatio: "1445 / 190" }}
      aria-label="MoonTicket"
    >
      <img
        src="/moonticket-banner.png"
        alt="MoonTicket"
        className="w-full h-auto block"
      />
    </div>
  );
}
