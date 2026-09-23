import { network } from "hardhat";

const BASE_SEPOLIA_CHAIN_ID = 84532n;
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const { ethers } = await network.connect();
const [deployer] = await ethers.getSigners();

const owner = process.env.OWNER_WALLET || deployer.address;
const platformWallet = process.env.PLATFORM_WALLET || deployer.address;
const authorizerWallet = process.env.AUTHORIZER_WALLET || deployer.address;
const paymentToken = process.env.USDC_ADDRESS || BASE_SEPOLIA_USDC;

console.log("Deploying from:", deployer.address);
console.log("Owner:", owner);
console.log("Platform wallet:", platformWallet);
console.log("Authorizer:", authorizerWallet);
console.log("USDC:", paymentToken);

const mashers = await ethers.deployContract("Mashers", [
  paymentToken,
  owner,
  platformWallet,
  authorizerWallet
]);
await mashers.waitForDeployment();

const parentA = await ethers.deployContract("MockParentNFT", [
  "Masher Test Parent A",
  "MTPA",
  owner
]);
await parentA.waitForDeployment();

const parentB = await ethers.deployContract("MockParentNFT", [
  "Masher Test Parent B",
  "MTPB",
  owner
]);
await parentB.waitForDeployment();

const mashersAddress = await mashers.getAddress();
const parentAAddress = await parentA.getAddress();
const parentBAddress = await parentB.getAddress();

if (owner.toLowerCase() === deployer.address.toLowerCase()) {
  await (await parentA.mint(deployer.address)).wait();
  await (await parentB.mint(deployer.address)).wait();

  await (
    await mashers.setCollection(
      BASE_SEPOLIA_CHAIN_ID,
      parentAAddress,
      process.env.COLLECTION_A_PAYOUT || deployer.address,
      true
    )
  ).wait();

  await (
    await mashers.setCollection(
      BASE_SEPOLIA_CHAIN_ID,
      parentBAddress,
      process.env.COLLECTION_B_PAYOUT || deployer.address,
      true
    )
  ).wait();
} else {
  console.log("Owner differs from deployer, so mock mint/allowlist setup was skipped.");
}

console.log(
  JSON.stringify(
    {
      chainId: Number(BASE_SEPOLIA_CHAIN_ID),
      mashers: mashersAddress,
      parentA: parentAAddress,
      parentB: parentBAddress,
      usdc: paymentToken,
      testParentTokenId: 1
    },
    null,
    2
  )
);
