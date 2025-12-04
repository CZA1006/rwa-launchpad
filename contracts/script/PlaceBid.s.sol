// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {MockUSDC} from "../src/mock/MockTokens.sol";
import {KYCValidationHook} from "../src/KYCValidationHook.sol"; 
import {IContinuousClearingAuction} from "../src/interfaces/IContinuousClearingAuction.sol";

contract PlaceBid is Script {
    address constant MOCK_USDC = 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707;
    address constant KYC_HOOK = 0xa513E6E4b8f2a923D98304ec87F64353C4D5C853;
    // ⚠️ 每次跑完 CreateAuction 后，手动更新这个地址
    address constant AUCTION_ADDRESS = 0x9722839353F9CC010A57b7763C535700b0470389; 

    uint256 constant BUYER_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d; 
    
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey); 
        address buyer = vm.addr(BUYER_PK);
        
        MockUSDC usdc = MockUSDC(MOCK_USDC);
        IContinuousClearingAuction auction = IContinuousClearingAuction(AUCTION_ADDRESS);
        KYCValidationHook kycHook = KYCValidationHook(KYC_HOOK);
        
        vm.startBroadcast(deployerPrivateKey);
        usdc.transfer(buyer, 1000 * 1e6); 
        console2.log("1. Transferred 1000 USDC to buyer:", buyer);
        vm.roll(block.number + 20); 
        vm.stopBroadcast();

        vm.startBroadcast(BUYER_PK);
        usdc.approve(AUCTION_ADDRESS, 1000 * 1e6);
        vm.expectRevert(abi.encodeWithSignature("NotKyced()")); 
        auction.submitBid(79385310659616088289723223000, 100 * 1e6, buyer, 0, hex""); 
        console2.log("3. Bid failed as expected (Not Kyced).");
        vm.stopBroadcast(); 

        vm.startBroadcast(deployerPrivateKey);
        kycHook.setKYC(buyer, true);
        console2.log("4. Admin Kyced buyer:", buyer);
        vm.stopBroadcast();

        vm.startBroadcast(BUYER_PK);
        uint256 bidId = auction.submitBid(79385310659616088289723223000, 100 * 1e6, buyer, 0, hex""); 
        console2.log("5. Bid successful! Bid ID:", bidId);
        vm.stopBroadcast();
    }
}