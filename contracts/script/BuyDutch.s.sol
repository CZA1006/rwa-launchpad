// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {MockUSDC, MockRWA} from "../src/mock/MockTokens.sol";
import {DutchAuction} from "../src/DutchAuction.sol";
import {KYCValidationHook} from "../src/KYCValidationHook.sol";

contract BuyDutch is Script {
    // --- 地址配置 (来自您刚才的日志) ---
    address constant MOCK_USDC = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    address constant KYC_HOOK = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0;
    
    // 【关键】刚才生成的荷式拍卖地址
    address constant AUCTION_ADDRESS = 0x94099942864EA81cCF197E9D71ac53310b1468D8;

    // 买家私钥 (Anvil Account 1)
    uint256 constant BUYER_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;

    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey);
        address buyer = vm.addr(BUYER_PK);

        MockUSDC usdc = MockUSDC(MOCK_USDC);
        DutchAuction auction = DutchAuction(AUCTION_ADDRESS);
        KYCValidationHook kycHook = KYCValidationHook(KYC_HOOK);

        // --- 1. 准备工作：发钱 & 过 KYC (由管理员操作) ---
        vm.startBroadcast(deployerPrivateKey);
        
        // 给买家转 1000 USDC (6 decimals)
        usdc.transfer(buyer, 1000 * 1e6);
        console2.log("1. Transferred 1000 USDC to buyer");
        
        // 给买家加白名单
        kycHook.setKYC(buyer, true);
        console2.log("2. Added buyer to KYC whitelist");
        
        vm.stopBroadcast();

        // --- 2. 时间旅行：模拟价格下降 ---
        console2.log("--- Time Travel: Warping 15 minutes ---");
        vm.warp(block.timestamp + 900); 

        // 查看当前价格 (18 decimals precision)
        uint256 currentPrice = auction.getCurrentPrice();
        console2.log("3. Current Price (after 15 mins):", currentPrice);

        // --- 3. 买家购买 (由买家操作) ---
        vm.startBroadcast(BUYER_PK);

        // 购买数量: 10 个 RWA (18 decimals)
        uint256 buyAmount = 10 * 1e18;
        
        // 【关键修复】给最大授权，防止时间偏差导致授权不足
        usdc.approve(AUCTION_ADDRESS, type(uint256).max);
        console2.log("4. Buyer approved USDC (Unlimited)");

        // 执行购买
        auction.buy(buyAmount);
        console2.log("5. BUY SUCCESSFUL! Bought 10 RWA");

        vm.stopBroadcast();
    }
}