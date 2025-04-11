// pages/burn.js

export default function Burn() {
  return (
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center justify-start py-10 px-4">
      <img
        src="/tix-logo-burn.png"
        alt="Burn to Earn"
        className="w-40 md:w-52 mb-6"
      />
      <h1 className="text-2xl md:text-3xl font-bold mb-4 text-center">
        Burn to Earn (Coming Soon)
      </h1>
      <p className="text-center max-w-2xl leading-relaxed">
        The Burn to Earn feature lets you destroy your $TIX in exchange for jackpot entries. 
        Each $1 burned (based on the current $TIX price) earns you entries at a <span className="font-bold">2:1 cost</span> — 
        meaning you’ll need to burn <span className="font-bold">$2 worth of $TIX</span> to earn 1 entry.
        <br /><br />
        Burn entries are subject to a <span className="font-bold">weekly cap</span> to maintain fairness and balance. 
        All burned tokens are permanently destroyed, making $TIX more scarce and increasing its long-term value.
        <br /><br />
        This deflationary mechanic is coming soon. Stay tuned!
      </p>
    </div>
  );
}
