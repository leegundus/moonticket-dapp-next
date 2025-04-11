// pages/whitepaper.js

export default function Whitepaper() {
  return (
    <div className="bg-black text-yellow-400 min-h-screen p-8">
      <h1 className="text-3xl font-bold text-center mb-6">Moonticket Whitepaper – April 2025 Edition</h1>

      <div className="max-w-3xl mx-auto space-y-6 text-lg">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Overview:</h2>
          <p>
            Moonticket is the ultimate weekly crypto lottery built on Solana — where <strong>holding $TIX earns you a shot at the moon</strong>.
            Users are <strong>rewarded with entries</strong> into the weekly jackpot draw for <strong>$TIX acquired through the Moonticket DApp</strong>.
          </p>
          <p>
            The more $TIX you own through the DApp, the more entries you receive — but you must <strong>hold $TIX at the time of the draw</strong> to stay eligible.
            This encourages stacking, loyalty, and long-term participation.
          </p>
          <p>
            DEX trading is coming soon. You’ll be able to <strong>buy/sell $TIX on-chain</strong>, in addition to staking, burning, and boosting with NFTs.
          </p>
          <p><strong>Launch price:</strong> $0.0001 per $TIX</p>
          <p><strong>Get your $TIX — and let’s take it to the moon.</strong></p>
        </section>

        <hr className="border-yellow-400 my-4" />

        {/* Jackpot Draw */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Jackpot Draw Mechanics</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Weekly Moon Draws</strong> are held every <strong>Monday at 10pm CentralTime</strong>.</li>
            <li>Jackpot is funded by DApp $TIX purchases (1% to Ops, 99% to Treasury).</li>
            <li>At draw time, a random winner is selected from the eligible entry pool.</li>
            <li><strong>Payout structure</strong>: 80% to winner, 20% to Ops Wallet</li>
          </ul>
        </section>

        <hr className="border-yellow-400 my-4" />

        {/* Entry Rules */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Entry Rules</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Entries are rewarded for $TIX purchased through the DApp only.</strong></li>
            <li>Users must <strong>hold $TIX at the time of the draw</strong> to remain eligible.</li>
            <li>Entries are determined <strong>at the time of drawing</strong>, based on your <strong>current $TIX balance and DApp purchase history</strong>.</li>
            <li>DEX-purchased or gifted $TIX does <strong>not</strong> generate entries.</li>
          </ul>
        </section>

        <hr className="border-yellow-400 my-4" />

        {/* Tokenomics */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Tokenomics</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Token Name</strong>: Moonticket</li>
            <li><strong>Symbol</strong>: $TIX</li>
            <li><strong>Total Supply</strong>: 1 Trillion</li>
            <li><strong>Decimals</strong>: 9</li>
            <li><strong>Launch Price</strong>: $0.0001 per $TIX</li>
            <li><strong>10%</strong> held by the team (founder wallet)</li>
            <li><strong>90%</strong> reserved for jackpots, staking, burns, and liquidity</li>
            <li>$TIX is a <strong>utility token</strong> for jackpots, staking, NFTs, and burns.</li>
          </ul>
        </section>

        <hr className="border-yellow-400 my-4" />

        {/* Burn to Earn */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Burn-to-Earn (Coming Soon)</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Burn $TIX to receive bonus jackpot entries.</li>
            <li><strong>2:1 USD ratio</strong>: Burn $2 of $TIX = 1 entry.</li>
            <li>Weekly cap on burn-based entries to maintain fairness.</li>
            <li>All burns are permanent and deflationary.</li>
          </ul>
        </section>

        <hr className="border-yellow-400 my-4" />

        {/* NFT Boosters */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">NFT Boosters (Coming Soon)</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Own special NFTs to boost your jackpot entries.</li>
            <li><strong>Gold Moonticket</strong>: +25% bonus entries — Mint Price: 1.00 SOL — Supply: 1,000</li>
            <li><strong>Silver Moonticket</strong>: +15% bonus entries — Mint Price: 0.60 SOL — Supply: 5,000</li>
            <li><strong>Bronze Moonticket</strong>: +5% bonus entries — Mint Price: 0.20 SOL — Supply: 10,000</li>
            <li>Boosts apply as long as you <strong>hold the NFT</strong> at draw time.</li>
            <li><strong>Boosts are stackable</strong> up to a maximum 100% boost.</li>
            <li>All mint proceeds go to the <strong>Ops Wallet</strong>. Secondary sales include a <strong>5% royalty</strong> to the Ops Wallet.</li>
          </ul>
        </section>

        <hr className="border-yellow-400 my-4" />

        {/* Staking */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Staking (Coming Soon)</h2>
          <p>Stake your $TIX to earn passive rewards. Longer lockups = higher APY.</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>30 Days</strong> — 10% APY</li>
            <li><strong>90 Days</strong> — 25% APY</li>
            <li><strong>180 Days</strong> — 50% APY</li>
          </ul>
          <p>Unstaking early will incur a penalty. Rewards are distributed in $TIX.</p>
        </section>

        <hr className="border-yellow-400 my-4" />

        {/* Treasury & Ops */}
        <section>
          <h2 className="text-2xl font-semibold mb-2">Ops & Treasury Structure</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>All SOL from DApp $TIX purchases is split:</li>
            <li><strong>99%</strong> to the Treasury Wallet (for jackpots)</li>
            <li><strong>1%</strong> to the Ops Wallet</li>
            <li>The Treasury Wallet funds the weekly Moon Draws.</li>
            <li>The Ops Wallet also receives <strong>20% of each jackpot payout</strong>.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
