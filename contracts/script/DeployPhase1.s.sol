// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {MockUSDC, MockRWA} from "../src/mock/MockTokens.sol";
import {ContinuousClearingAuctionFactory} from "../src/ContinuousClearingAuctionFactory.sol";
import {KYCValidationHook} from "../src/KYCValidationHook.sol"; 

contract DeployPhase1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. 部署 USDC
        MockUSDC usdc = new MockUSDC();
        console2.log("MockUSDC deployed at:", address(usdc));

        // 2. 部署 RWA
        MockRWA rwa = new MockRWA();
        console2.log("MockRWA deployed at:", address(rwa));

        // 3. 部署 KYC Hook
        address kycHookAddr = address(new KYCValidationHook());
        console2.log("KYCValidationHook deployed at:", kycHookAddr);

        // 4. 部署 CCA 拍卖工厂
        ContinuousClearingAuctionFactory factory = new ContinuousClearingAuctionFactory();
        console2.log("AuctionFactory deployed at:", address(factory));

        // 5. Hook 初始化 (给自己加白名单)
        KYCValidationHook(kycHookAddr).setKYC(deployer, true);
        console2.log("KYC set for deployer:", deployer);

        vm.stopBroadcast();
        
        // 汇总输出，方便复制
        console2.log("-------------------------------------------");
        console2.log("Deployment Complete. Addresses below:");
        console2.log("MOCK_USDC:", address(usdc));
        console2.log("MOCK_RWA:", address(rwa));
        console2.log("KYC_HOOK:", kycHookAddr);
        console2.log("FACTORY:", address(factory));
        console2.log("-------------------------------------------");
    }
}