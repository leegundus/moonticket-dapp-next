// pages/nfts.js

export default function NFTs() {
  return (
    <div className="min-h-screen bg-black text-yellow-400 text-center py-12 px-6 pt-40">
      <h1 className="text-3xl md:text-4xl font-bold mb-6">NFTs (Coming Soon)</h1>
      <p className="max-w-2xl mx-auto text-lg md:text-xl mb-10">
        Moonticket NFTs will offer entry boosts that will be stackable. Boost your jackpot odds just by holding a Gold, Silver, or Bronze NFT in your wallet.
        Each NFT tier offers a different bonus — and boosts can be stacked up to a maximum of 100%. NFT staking features will also be introduced.
        Total supply: 1,000 Gold, 5,000 Silver, 10,000 Bronze.
      </p>

      <div className="space-y-10">
        <img
          src="/gold-nft-info.png"
          alt="Gold NFT Info"
          className="mx-auto w-4/5 md:w-1/2"
        />
        <img
          src="/silver-nft-info.png"
          alt="Silver NFT Info"
          className="mx-auto w-4/5 md:w-1/2"
        />
        <img
          src="/bronze-nft-info.png"
          alt="Bronze NFT Info"
          className="mx-auto w-4/5 md:w-1/2"
        />
      </div>
    </div>
  );
}

