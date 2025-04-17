export default function Whitepaper() {
  return (
    <div className="bg-black text-yellow-400 min-h-screen p-8 text-center">
      <h1 className="text-3xl font-bold mb-6">Moonticket Whitepaper – April 2025 Edition</h1>

      {/* Overview */}
      <div className="max-w-3xl mx-auto text-left space-y-4 text-lg">
        <h2 className="text-2xl font-semibold mb-2 text-center">Overview</h2>
        <p>
          Moonticket is the ultimate weekly crypto lottery built on Solana. By purchasing $TIX through the official Moonticket DApp, users automatically earn entries into a weekly jackpot drawing — held every Monday night. The more $TIX you buy, the more entries you get. However, to remain eligible, you must still be holding those tokens at the time of the draw.
        </p>
        <p>
          This design encourages ongoing participation and reward loyalty. Moonticket’s future roadmap includes NFTs that boost your entries, the ability to stake $TIX for passive yield, and a burn-to-earn mechanic that reduces token supply while granting bonus entries.
        </p>
        <p><strong>Launch price:</strong> $0.0001 per $TIX</p>
        <p><strong>Get your $TIX — and let’s take it to the moon.</strong></p>
      </div>

      {/* Phase 1 */}
      <img src="/new-moon-phase-1.png" alt="Phase 1" className="mx-auto w-96 my-12" />

      <div className="max-w-3xl mx-auto text-left space-y-6 text-lg">
        <section>
          <h2 className="text-2xl font-semibold text-center mb-2">Jackpot Draw Mechanics</h2>
          <p>
            The Moonticket DApp funds a weekly jackpot pool. Every Monday at 10pm CT, a winner is randomly selected from the current entry pool. Entries are based solely on DApp purchases made within the active draw window. The winner receives 80% of the jackpot in SOL, and the remaining 20% is sent to the Ops Wallet for operational and development growth.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-center mb-2">DApp Entry Rules</h2>
          <p>
            Entries are generated only when users purchase $TIX through the official Moonticket DApp. You must still be holding those $TIX at the time of the drawing to remain eligible. $TIX received through DEXs, transfers, or gifts do not contribute toward entries.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-center mb-2">Tokenomics</h2>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Token:</strong> Moonticket ($TIX)</li>
            <li><strong>Total Supply:</strong> 1 Trillion</li>
            <li><strong>Decimals:</strong> 9</li>
            <li><strong>Launch Price:</strong> $0.0001 per $TIX</li>
            <li><strong>Allocation:</strong> 10% to team wallet, 90% to jackpots, staking, burns, liquidity</li>
          </ul>
        </section>
      </div>

      {/* Phase 2 */}
      <img src="/half-moon-phase-2.png" alt="Phase 2" className="mx-auto w-96 my-12" />

      <div className="max-w-3xl mx-auto text-left space-y-6 text-lg">
        <section>
          <h2 className="text-2xl font-semibold text-center mb-2">NFT Boosters (Coming Soon)</h2>
          <p>
            Moonticket will launch limited-edition NFTs that boost your jackpot entries. Each NFT must be held at the time of the draw to activate its bonus. Boosts are stackable and can reach up to 100% total. All mint proceeds go to the Ops Wallet, and a 5% royalty applies to secondary sales.
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>Gold Moonticket:</strong> +25% boost — 1.00 SOL — 1,000 supply</li>
            <li><strong>Silver Moonticket:</strong> +15% boost — 0.60 SOL — 5,000 supply</li>
            <li><strong>Bronze Moonticket:</strong> +5% boost — 0.20 SOL — 10,000 supply</li>
          </ul>
        </section>
      </div>

      {/* Phase 3 */}
      <img src="/full-moon-phase-3.png" alt="Phase 3" className="mx-auto w-96 my-12" />

      <div className="max-w-3xl mx-auto text-left space-y-6 text-lg">

        <section>
          <h2 className="text-2xl font-semibold text-center mb-2">Staking</h2>
          <p>
            Users will be able to stake $TIX tokens to earn passive yield. The longer the staking period, the higher the annualized return. All staking rewards will be paid out in $TIX, and early unstaking may result in penalties.
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>30 Days:</strong> 10% APY</li>
            <li><strong>90 Days:</strong> 25% APY</li>
            <li><strong>180 Days:</strong> 50% APY</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-center mb-2">Burn-to-Earn</h2>
          <p>
            Moonticket introduces a deflationary mechanic where users can permanently burn $TIX in exchange for bonus entries into the weekly draw. For every $2 worth of $TIX you burn, you’ll receive 1 extra jackpot entry. Weekly caps may apply to ensure fairness across all holders.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-center mb-2">DEX Trading</h2>
          <p>
            $TIX will eventually be available on Solana DEXes like Raydium. Once listed, users will be able to freely trade $TIX.
          </p>
        </section>
      </div>
    </div>
  );
}
