// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Per-Masher royalty receiver. Each Masher gets its own splitter.
/// @dev Four equal 25% royalty slots:
///      0 = Mashers platform, 1 = original Masher creator,
///      2 = source collection A, 3 = source collection B.
contract MasherRoyaltySplitter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant SLOT_COUNT = 4;

    address[4] public recipients;
    uint256[4] public nativeReleased;
    uint256 public totalNativeReleased;

    mapping(address token => mapping(uint256 slot => uint256 amount)) public tokenReleased;
    mapping(address token => uint256 amount) public totalTokenReleased;

    event NativeReceived(address indexed from, uint256 amount);
    event NativeReleased(uint256 indexed slot, address indexed recipient, uint256 amount);
    event TokenReleased(address indexed token, uint256 indexed slot, address indexed recipient, uint256 amount);

    constructor(address[4] memory recipients_) {
        for (uint256 i = 0; i < SLOT_COUNT; i++) {
            require(recipients_[i] != address(0), "zero recipient");
            recipients[i] = recipients_[i];
        }
    }

    receive() external payable {
        emit NativeReceived(msg.sender, msg.value);
    }

    function releasableNative(uint256 slot) public view returns (uint256) {
        require(slot < SLOT_COUNT, "bad slot");
        uint256 totalReceived = address(this).balance + totalNativeReleased;
        uint256 entitlement = totalReceived / SLOT_COUNT;
        return entitlement - nativeReleased[slot];
    }

    function releaseNative(uint256 slot) external nonReentrant {
        require(slot < SLOT_COUNT, "bad slot");
        require(msg.sender == recipients[slot], "not recipient");

        uint256 amount = releasableNative(slot);
        require(amount > 0, "nothing due");

        nativeReleased[slot] += amount;
        totalNativeReleased += amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "native transfer failed");

        emit NativeReleased(slot, msg.sender, amount);
    }

    function releasableToken(address token, uint256 slot) public view returns (uint256) {
        require(slot < SLOT_COUNT, "bad slot");
        IERC20 erc20 = IERC20(token);
        uint256 totalReceived = erc20.balanceOf(address(this)) + totalTokenReleased[token];
        uint256 entitlement = totalReceived / SLOT_COUNT;
        return entitlement - tokenReleased[token][slot];
    }

    function releaseToken(address token, uint256 slot) external nonReentrant {
        require(slot < SLOT_COUNT, "bad slot");
        require(msg.sender == recipients[slot], "not recipient");

        uint256 amount = releasableToken(token, slot);
        require(amount > 0, "nothing due");

        tokenReleased[token][slot] += amount;
        totalTokenReleased[token] += amount;

        IERC20(token).safeTransfer(msg.sender, amount);
        emit TokenReleased(token, slot, msg.sender, amount);
    }
}
