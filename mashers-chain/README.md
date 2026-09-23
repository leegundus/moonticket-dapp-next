# Mashers Chain Prototype

This folder is intentionally isolated from the MoonTicket Next.js app so Vercel does not need to compile Solidity.

## V1 economics

- Chain: Base
- Test network: Base Sepolia (chain ID 84532)
- Creation fee: 5 USDC
  - 3 USDC -> Mashers platform wallet
  - 1 USDC -> source collection A payout wallet
  - 1 USDC -> source collection B payout wallet
- Secondary royalty signal: 8% using ERC-2981
  - 2% -> Mashers
  - 2% -> original Masher creator
  - 2% -> source collection A
  - 2% -> source collection B

Each minted Masher gets a dedicated `MasherRoyaltySplitter` contract. It can split native-token or ERC-20 royalty receipts into four equal shares.

## Why mint vouchers exist

The Masher NFT is minted on Base, but source NFTs may live on Ethereum, Base, or later other chains. A Base contract cannot directly read Ethereum mainnet ownership.

The web backend therefore:

1. verifies that the creator currently owns both source NFTs on their native chains,
2. creates the Masher art/metadata,
3. signs an EIP-712 `MintVoucher`,
4. returns the voucher to the browser,
5. the creator submits it to the Base Mashers contract.

The contract verifies the Mashers authorizer signature and prevents the exact same source pair from being minted twice.

## Install and compile

```bash
cd mashers-chain
npm install
npm run compile
```

## Deploy to Base Sepolia

Use a dedicated TESTNET wallet only.

```bash
export DEPLOYER_PRIVATE_KEY=0x...
export PLATFORM_WALLET=0x...
export AUTHORIZER_WALLET=0x...
npm run deploy:base-sepolia
```

The script uses the Base Sepolia public RPC by default and Circle test USDC at:

`0x036CbD53842c5426634e7929541eC2318f3dCF7e`

For production, use a managed RPC and a hardware-wallet/multisig deployment process.

## Important royalty note

ERC-2981 tells compatible marketplaces the royalty recipient and amount; it does not force every possible NFT transfer or marketplace to pay royalties. Marketplace-specific enforcement can be added after the Base Sepolia prototype is validated.
