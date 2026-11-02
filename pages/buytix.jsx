export default function BuyTixRelaunch() {
  return (
    <div className="min-h-screen bg-black text-yellow-400 flex items-center justify-center px-6 pt-32">
      <div className="max-w-2xl text-center border border-yellow-400/40 rounded-xl p-8">
        <h1 className="text-3xl font-bold">TIX Trading Relaunch</h1>
        <p className="mt-5 text-lg leading-relaxed">
          The old direct-sale Buy TIX flow is disabled in the MoonTicket V2 preview.
        </p>
        <p className="mt-4 leading-relaxed">
          V2 will reconnect TIX to real Solana market trading and liquidity so the token has a
          single market price. Buying TIX will not create extra weekly drawing entries.
        </p>
        <p className="mt-6 text-sm break-all">
          TIX Mint: 8e9Mqnczw7MHjdjYaRe3tppbXgRdT6bqTyR3n8b4C4Ek
        </p>
      </div>
    </div>
  );
}
