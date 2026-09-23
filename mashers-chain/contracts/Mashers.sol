// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {MasherRoyaltySplitter} from "./MasherRoyaltySplitter.sol";

/// @title Mashers
/// @notice Creates Base ERC-721 Mashers from two approved source NFTs.
/// @dev Source NFTs may live on other chains. A trusted Mashers authorizer verifies
///      source ownership off-chain and signs an EIP-712 MintVoucher that this contract verifies.
contract Mashers is ERC721URIStorage, ERC2981, Ownable, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    uint256 public constant MASH_FEE = 5_000_000; // $5 USDC (6 decimals)
    uint256 public constant PLATFORM_CREATION_SHARE = 3_000_000;
    uint256 public constant COLLECTION_CREATION_SHARE = 1_000_000;
    uint96 public constant ROYALTY_BPS = 800; // 8%

    bytes32 public constant MINT_VOUCHER_TYPEHASH = keccak256(
        "MintVoucher(address creator,uint256 parentAChainId,address parentACollection,uint256 parentATokenId,uint256 parentBChainId,address parentBCollection,uint256 parentBTokenId,bytes32 tokenURIHash,uint256 deadline)"
    );

    struct CollectionConfig {
        address payout;
        bool enabled;
    }

    struct MintVoucher {
        address creator;
        uint256 parentAChainId;
        address parentACollection;
        uint256 parentATokenId;
        uint256 parentBChainId;
        address parentBCollection;
        uint256 parentBTokenId;
        bytes32 tokenURIHash;
        uint256 deadline;
    }

    struct MasherInfo {
        address creator;
        uint256 parentAChainId;
        address parentACollection;
        uint256 parentATokenId;
        uint256 parentBChainId;
        address parentBCollection;
        uint256 parentBTokenId;
        address royaltySplitter;
        bytes32 pairKey;
    }

    IERC20 public immutable usdc;
    address public platformWallet;
    address public authorizer;

    uint256 private _nextTokenId;

    mapping(bytes32 collectionKey => CollectionConfig config) public collections;
    mapping(bytes32 pairKey => bool used) public pairUsed;
    mapping(uint256 tokenId => MasherInfo info) private _masherInfo;

    event CollectionConfigured(
        uint256 indexed chainId,
        address indexed collection,
        address indexed payout,
        bool enabled
    );

    event PlatformWalletUpdated(address indexed previousWallet, address indexed newWallet);
    event AuthorizerUpdated(address indexed previousAuthorizer, address indexed newAuthorizer);

    event MasherCreated(
        uint256 indexed tokenId,
        address indexed creator,
        bytes32 indexed pairKey,
        uint256 parentAChainId,
        address parentACollection,
        uint256 parentATokenId,
        uint256 parentBChainId,
        address parentBCollection,
        uint256 parentBTokenId,
        address royaltySplitter
    );

    constructor(
        address paymentToken,
        address initialOwner,
        address initialPlatformWallet,
        address initialAuthorizer
    )
        ERC721("Mashers", "MASH")
        Ownable(initialOwner)
        EIP712("Mashers", "1")
    {
        require(paymentToken != address(0), "zero payment token");
        require(initialOwner != address(0), "zero owner");
        require(initialPlatformWallet != address(0), "zero platform wallet");
        require(initialAuthorizer != address(0), "zero authorizer");
        require(IERC20Metadata(paymentToken).decimals() == 6, "payment token must use 6 decimals");

        usdc = IERC20(paymentToken);
        platformWallet = initialPlatformWallet;
        authorizer = initialAuthorizer;
    }

    function collectionKey(uint256 chainId, address collection) public pure returns (bytes32) {
        return keccak256(abi.encode(chainId, collection));
    }

    function setCollection(
        uint256 chainId,
        address collection,
        address payout,
        bool enabled
    ) external onlyOwner {
        require(chainId != 0, "zero chain");
        require(collection != address(0), "zero collection");
        if (enabled) require(payout != address(0), "zero payout");

        collections[collectionKey(chainId, collection)] = CollectionConfig({
            payout: payout,
            enabled: enabled
        });

        emit CollectionConfigured(chainId, collection, payout, enabled);
    }

    function setPlatformWallet(address newWallet) external onlyOwner {
        require(newWallet != address(0), "zero platform wallet");
        address previous = platformWallet;
        platformWallet = newWallet;
        emit PlatformWalletUpdated(previous, newWallet);
    }

    function setAuthorizer(address newAuthorizer) external onlyOwner {
        require(newAuthorizer != address(0), "zero authorizer");
        address previous = authorizer;
        authorizer = newAuthorizer;
        emit AuthorizerUpdated(previous, newAuthorizer);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function createMasher(
        MintVoucher calldata voucher,
        string calldata tokenURI_,
        bytes calldata signature
    ) external whenNotPaused nonReentrant returns (uint256 tokenId) {
        require(voucher.creator == msg.sender, "creator mismatch");
        require(block.timestamp <= voucher.deadline, "voucher expired");
        require(keccak256(bytes(tokenURI_)) == voucher.tokenURIHash, "token URI mismatch");

        bytes32 structHash = keccak256(
            abi.encode(
                MINT_VOUCHER_TYPEHASH,
                voucher.creator,
                voucher.parentAChainId,
                voucher.parentACollection,
                voucher.parentATokenId,
                voucher.parentBChainId,
                voucher.parentBCollection,
                voucher.parentBTokenId,
                voucher.tokenURIHash,
                voucher.deadline
            )
        );

        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == authorizer, "invalid authorizer");

        CollectionConfig memory configA = collections[
            collectionKey(voucher.parentAChainId, voucher.parentACollection)
        ];
        CollectionConfig memory configB = collections[
            collectionKey(voucher.parentBChainId, voucher.parentBCollection)
        ];

        require(configA.enabled, "collection A not approved");
        require(configB.enabled, "collection B not approved");

        bytes32 key = _pairKey(voucher);
        require(!pairUsed[key], "pair already mashed");
        pairUsed[key] = true;

        usdc.safeTransferFrom(msg.sender, platformWallet, PLATFORM_CREATION_SHARE);
        usdc.safeTransferFrom(msg.sender, configA.payout, COLLECTION_CREATION_SHARE);
        usdc.safeTransferFrom(msg.sender, configB.payout, COLLECTION_CREATION_SHARE);

        tokenId = ++_nextTokenId;

        address[4] memory royaltyRecipients;
        royaltyRecipients[0] = platformWallet;
        royaltyRecipients[1] = msg.sender;
        royaltyRecipients[2] = configA.payout;
        royaltyRecipients[3] = configB.payout;

        MasherRoyaltySplitter splitter = new MasherRoyaltySplitter(royaltyRecipients);

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        _setTokenRoyalty(tokenId, address(splitter), ROYALTY_BPS);

        _masherInfo[tokenId] = MasherInfo({
            creator: msg.sender,
            parentAChainId: voucher.parentAChainId,
            parentACollection: voucher.parentACollection,
            parentATokenId: voucher.parentATokenId,
            parentBChainId: voucher.parentBChainId,
            parentBCollection: voucher.parentBCollection,
            parentBTokenId: voucher.parentBTokenId,
            royaltySplitter: address(splitter),
            pairKey: key
        });

        emit MasherCreated(
            tokenId,
            msg.sender,
            key,
            voucher.parentAChainId,
            voucher.parentACollection,
            voucher.parentATokenId,
            voucher.parentBChainId,
            voucher.parentBCollection,
            voucher.parentBTokenId,
            address(splitter)
        );
    }

    function masherInfo(uint256 tokenId) external view returns (MasherInfo memory) {
        ownerOf(tokenId); // reverts if nonexistent
        return _masherInfo[tokenId];
    }

    function voucherDigest(MintVoucher calldata voucher) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_VOUCHER_TYPEHASH,
                voucher.creator,
                voucher.parentAChainId,
                voucher.parentACollection,
                voucher.parentATokenId,
                voucher.parentBChainId,
                voucher.parentBCollection,
                voucher.parentBTokenId,
                voucher.tokenURIHash,
                voucher.deadline
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function _pairKey(MintVoucher calldata voucher) internal pure returns (bytes32) {
        bytes32 parentA = keccak256(
            abi.encode(voucher.parentAChainId, voucher.parentACollection, voucher.parentATokenId)
        );
        bytes32 parentB = keccak256(
            abi.encode(voucher.parentBChainId, voucher.parentBCollection, voucher.parentBTokenId)
        );

        require(parentA != parentB, "same NFT twice");

        if (uint256(parentA) < uint256(parentB)) {
            return keccak256(abi.encode(parentA, parentB));
        }
        return keccak256(abi.encode(parentB, parentA));
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
