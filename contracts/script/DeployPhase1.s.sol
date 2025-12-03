// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC, MockRWA} from "../src/mock/MockTokens.sol";
import {KYCValidationHook} from "../src/KYCValidationHook.sol";
// 【新增】引入工厂合约
import {ContinuousClearingAuctionFactory} from "../src/ContinuousClearingAuctionFactory.sol";

contract DeployPhase1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployerAddress = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. 部署 USDC
        MockUSDC usdc = new MockUSDC();
        console2.log("MockUSDC deployed at:", address(usdc));

        // 2. 部署 RWA (股权代币)
        MockRWA rwa = new MockRWA();
        console2.log("MockRWA deployed at:", address(rwa));

        // 3. 部署 KYC Hook
        KYCValidationHook kycHook = new KYCValidationHook();
        console2.log("KYCValidationHook deployed at:", address(kycHook));

        // 4. Hook 初始化 (把自己加白名单)
        kycHook.setKYC(deployerAddress, true);
        console2.log("KYC set for deployer:", deployerAddress);

        // 5. 【新增】部署拍卖工厂 (Auction House)
        // 既然没有构造函数参数，直接 new 即可
        ContinuousClearingAuctionFactory factory = new ContinuousClearingAuctionFactory();
        console2.log("AuctionFactory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}