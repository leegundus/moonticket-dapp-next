import {
  Contract,
  JsonRpcProvider,
  Wallet,
  getAddress,
  isAddress,
  keccak256,
  toUtf8Bytes,
} from "ethers";

const ERC721_ABI = ["function ownerOf(uint256 tokenId) view returns (address)"];

const MINT_VOUCHER_TYPES = {
  MintVoucher: [
    { name: "creator", type: "address" },
    { name: "parentAChainId", type: "uint256" },
    { name: "parentACollection", type: "address" },
    { name: "parentATokenId", type: "uint256" },
    { name: "parentBChainId", type: "uint256" },
    { name: "parentBCollection", type: "address" },
    { name: "parentBTokenId", type: "uint256" },
    { name: "tokenURIHash", type: "bytes32" },
    { name: "deadline", type: "uint256" },
  ],
};

function rpcForChain(chainId) {
  if (chainId === 84532) {
    return process.env.MASHERS_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
  }
  if (chainId === 8453) {
    return process.env.MASHERS_BASE_RPC_URL || "https://mainnet.base.org";
  }
  if (chainId === 1) {
    if (!process.env.MASHERS_ETHEREUM_RPC_URL) {
      throw new Error("Ethereum RPC is not configured yet");
    }
    return process.env.MASHERS_ETHEREUM_RPC_URL;
  }
  throw new Error("Unsupported source chain: " + chainId);
}

function chainName(chainId) {
  if (chainId === 1) return "Ethereum";
  if (chainId === 8453) return "Base";
  if (chainId === 84532) return "Base Sepolia";
  return "Chain " + chainId;
}

function parseParent(value, label) {
  const chainId = Number(value && value.chainId);
  const collection = value && value.collection;
  const tokenId = String((value && value.tokenId) ?? "").trim();

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(label + ": invalid chain");
  }
  if (!isAddress(collection || "")) {
    throw new Error(label + ": invalid collection address");
  }
  if (!/^\d+$/.test(tokenId)) {
    throw new Error(label + ": token ID must be a non-negative integer");
  }

  return {
    chainId,
    collection: getAddress(collection),
    tokenId,
  };
}

async function verifyOwner(parent, creator) {
  const provider = new JsonRpcProvider(rpcForChain(parent.chainId));
  const nft = new Contract(parent.collection, ERC721_ABI, provider);
  const owner = await nft.ownerOf(parent.tokenId);

  if (owner.toLowerCase() !== creator.toLowerCase()) {
    throw new Error(
      "Connected wallet does not own " +
        chainName(parent.chainId) +
        " " +
        parent.collection +
        " #" +
        parent.tokenId
    );
  }
}

function shortAddress(address) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildTestMetadata(parentA, parentB, creator) {
  const a =
    chainName(parentA.chainId) +
    " · " +
    shortAddress(parentA.collection) +
    " #" +
    parentA.tokenId;
  const b =
    chainName(parentB.chainId) +
    " · " +
    shortAddress(parentB.collection) +
    " #" +
    parentB.tokenId;

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">' +
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#080b1a"/><stop offset="45%" stop-color="#2b145d"/>' +
    '<stop offset="100%" stop-color="#091f3b"/></linearGradient></defs>' +
    '<rect width="1000" height="1000" rx="60" fill="url(#bg)"/>' +
    '<circle cx="500" cy="390" r="250" fill="none" stroke="#22d3ee" stroke-width="18" opacity=".6"/>' +
    '<path d="M285 435 C365 250 435 255 500 430 C565 255 635 250 715 435 C640 610 570 620 500 470 C430 620 360 610 285 435Z" fill="none" stroke="#f8fafc" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<text x="500" y="150" text-anchor="middle" fill="#ffffff" font-size="78" font-family="Arial" font-weight="800">MASHERS</text>' +
    '<text x="500" y="700" text-anchor="middle" fill="#67e8f9" font-size="30" font-family="Arial">TEST FUSION</text>' +
    '<text x="500" y="770" text-anchor="middle" fill="#ffffff" font-size="25" font-family="Arial">' +
    escapeXml(a) +
    "</text>" +
    '<text x="500" y="815" text-anchor="middle" fill="#ffffff" font-size="27" font-family="Arial">x</text>' +
    '<text x="500" y="860" text-anchor="middle" fill="#ffffff" font-size="25" font-family="Arial">' +
    escapeXml(b) +
    "</text>" +
    '<text x="500" y="935" text-anchor="middle" fill="#94a3b8" font-size="20" font-family="Arial">Base Sepolia prototype - not final artwork</text>' +
    "</svg>";

  const image =
    "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");

  const metadata = {
    name: "Masher Test Fusion",
    description:
      "Mashers Base Sepolia prototype. Final Mashers will use generated fusion artwork and permanent decentralized metadata.",
    image,
    external_url: "https://moonticket.io/mashers",
    attributes: [
      { trait_type: "Parent A Chain", value: chainName(parentA.chainId) },
      { trait_type: "Parent A Collection", value: parentA.collection },
      { trait_type: "Parent A Token", value: parentA.tokenId },
      { trait_type: "Parent B Chain", value: chainName(parentB.chainId) },
      { trait_type: "Parent B Collection", value: parentB.collection },
      { trait_type: "Parent B Token", value: parentB.tokenId },
      { trait_type: "Prototype", value: "Base Sepolia" },
    ],
    properties: {
      creator,
      parents: [parentA, parentB],
    },
  };

  const tokenURI =
    "data:application/json;base64," +
    Buffer.from(JSON.stringify(metadata)).toString("base64");

  return { tokenURI, image };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const creator = req.body && req.body.creator;
    if (!isAddress(creator || "")) {
      return res.status(400).json({ error: "Invalid creator wallet" });
    }

    const contractAddress =
      process.env.NEXT_PUBLIC_MASHERS_CONTRACT ||
      process.env.MASHERS_CONTRACT_ADDRESS;
    const privateKey = process.env.MASHERS_AUTHORIZER_PRIVATE_KEY;
    const mintChainId = Number(
      process.env.NEXT_PUBLIC_MASHERS_CHAIN_ID || 84532
    );

    if (!isAddress(contractAddress || "")) {
      return res.status(503).json({
        error: "Mashers contract is not deployed/configured yet",
      });
    }
    if (!privateKey) {
      return res.status(503).json({
        error: "Mashers authorizer key is not configured yet",
      });
    }

    const normalizedCreator = getAddress(creator);
    const parentA = parseParent(req.body && req.body.parentA, "Parent A");
    const parentB = parseParent(req.body && req.body.parentB, "Parent B");

    if (
      parentA.chainId === parentB.chainId &&
      parentA.collection.toLowerCase() === parentB.collection.toLowerCase() &&
      parentA.tokenId === parentB.tokenId
    ) {
      return res.status(400).json({ error: "Choose two different NFTs" });
    }

    await Promise.all([
      verifyOwner(parentA, normalizedCreator),
      verifyOwner(parentB, normalizedCreator),
    ]);

    const built = buildTestMetadata(parentA, parentB, normalizedCreator);

    const voucher = {
      creator: normalizedCreator,
      parentAChainId: String(parentA.chainId),
      parentACollection: parentA.collection,
      parentATokenId: parentA.tokenId,
      parentBChainId: String(parentB.chainId),
      parentBCollection: parentB.collection,
      parentBTokenId: parentB.tokenId,
      tokenURIHash: keccak256(toUtf8Bytes(built.tokenURI)),
      deadline: String(Math.floor(Date.now() / 1000) + 15 * 60),
    };

    const signer = new Wallet(privateKey);
    const domain = {
      name: "Mashers",
      version: "1",
      chainId: mintChainId,
      verifyingContract: getAddress(contractAddress),
    };

    const signature = await signer.signTypedData(
      domain,
      MINT_VOUCHER_TYPES,
      voucher
    );

    return res.status(200).json({
      ok: true,
      voucher,
      signature,
      tokenURI: built.tokenURI,
      previewImage: built.image,
      authorizer: signer.address,
    });
  } catch (error) {
    console.error("Mashers authorize error", error);
    return res.status(400).json({
      error:
        (error && (error.shortMessage || error.message)) ||
        "Unable to authorize Masher",
    });
  }
}
