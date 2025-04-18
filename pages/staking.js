export default function Staking() {
  return (
    <div className="bg-black text-yellow-400 min-h-screen p-6 flex flex-col items-center text-center pt-40">
      <img
        src="/tix-logo-staking-2.png"
        alt="Staking Logo"
        className="mx-auto"
      />
      <h1 className="text-3xl font-bold mb-4">Staking (Coming Soon)</h1>
      <p className="mb-6 max-w-xl">
        Stake your $TIX and earn passive rewards based on your commitment! Moonticket staking offers
        three tiers with escalating APYs depending on lock-up duration:
      </p>

      <div className="text-center mb-6 space-y-2">
        <p><strong>Tier 1:</strong> 30-day lockup — <span className="text-white">10% APY</span></p>
        <p><strong>Tier 2:</strong> 90-day lockup — <span className="text-white">25% APY</span></p>
        <p><strong>Tier 3:</strong> 180-day lockup — <span className="text-white">50% APY</span></p>
      </div>

      <p className="max-w-xl">
        Rewards will be distributed in $TIX. Early withdrawals may forfeit rewards.
        This feature is under development — check back soon for the official staking launch!
      </p>
    </div>
  );
}
