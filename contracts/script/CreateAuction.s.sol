// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {MockUSDC, MockRWA} from "../src/mock/MockTokens.sol";
import {ContinuousClearingAuctionFactory} from "../src/ContinuousClearingAuctionFactory.sol";
import {AuctionParameters} from "../src/interfaces/IContinuousClearingAuction.sol";

contract CreateAuction is Script {
    // --- 地址来自 Turn 48 日志 ---
    address constant MOCK_USDC = 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707;
    address constant MOCK_RWA = 0x0165878A594ca255338adfa4d48449f69242Eb8F;
    address constant KYC_HOOK = 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853;
    address constant FACTORY = 0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6;

    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        uint256 auctionSupply = 1_000_000 * 1e18; 
        uint64 durationBlocks = 100;
        uint24 mpsPerBlock = 100_000;
        bytes memory stepsData = abi.encodePacked(mpsPerBlock, uint40(durationBlocks));

        AuctionParameters memory params = AuctionParameters({
            currency: MOCK_USDC,
            tokensRecipient: deployer,
            fundsRecipient: deployer,
            startBlock: uint64(block.number + 10),
            endBlock: uint64(block.number + 10 + durationBlocks),
            claimBlock: uint64(block.number + 10 + durationBlocks + 1),
            tickSpacing: 10, 
            validationHook: KYC_HOOK,
            // Tick 200 Price Q96
            floorPrice: 79385310659616088289723223000, 
            requiredCurrencyRaised: 0,
            auctionStepsData: stepsData
        });

        bytes memory configData = abi.encode(params);

        MockRWA(MOCK_RWA).approve(FACTORY, auctionSupply);
        console2.log("Approved Factory to spend RWA");

        address newAuction = address(
            ContinuousClearingAuctionFactory(FACTORY).initializeDistribution(
                MOCK_RWA,
                auctionSupply,
                configData,
                bytes32(0) 
            )
        );
        
        // 手动注入资金 (因为 CCA Factory 没有自动拉取)
        MockRWA(MOCK_RWA).transfer(newAuction, auctionSupply);
        console2.log("Funded Auction:", newAuction);

        console2.log("-------------------------------------------");
        console2.log(">>> NEW CCA AUCTION CREATED AT:", newAuction);
        console2.log("-------------------------------------------");

        vm.stopBroadcast();
    }
}