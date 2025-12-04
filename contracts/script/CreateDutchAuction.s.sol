// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {MockUSDC, MockRWA} from "../src/mock/MockTokens.sol";
import {DutchAuctionFactory} from "../src/DutchAuctionFactory.sol";
import {DutchAuctionParams} from "../src/interfaces/IDutchAuction.sol";

contract CreateDutchAuction is Script {
    // --- 【已更新】使用您最新部署的地址 ---
    address constant MOCK_USDC = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    address constant MOCK_RWA = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512;
    address constant KYC_HOOK = 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. 部署新的荷式拍卖工厂
        DutchAuctionFactory factory = new DutchAuctionFactory();
        console2.log("DutchAuctionFactory deployed at:", address(factory));

        // 2. 准备拍卖参数 (模拟两天内的多轮竞拍)
        uint256 totalRounds = 48; // 共 48 轮
        uint256 roundDuration = 30 minutes; // 每轮 30 分钟
        uint256 supplyPerRound = 10_000 * 1e18; // 每轮释放 10,000 RWA
        
        // 计算本次拍卖需要的总货量
        uint256 totalAuctionSupply = totalRounds * supplyPerRound; 

        DutchAuctionParams memory params = DutchAuctionParams({
            currency: MOCK_USDC,
            token: MOCK_RWA,
            kycHook: KYC_HOOK,      // 复用之前的 KYC Hook
            recipient: deployer,    // 募集资金给 Deployer
            totalRounds: totalRounds,
            roundDuration: roundDuration,
            supplyPerRound: supplyPerRound,
            
            // 价格设置 (假设 18 精度)
            startPrice: 10 * 1e18,  // 起拍价 $10
            floorPrice: 1 * 1e18,   // 底价 $1
            
            minIssuance: 1000 * 1e18, // 最小发行量
            startTime: block.timestamp + 60 // 1分钟后开始
        });

        // 3. 授权 Factory 划转 RWA 代币
        // (Deployer -> Factory -> NewAuction)
        MockRWA(MOCK_RWA).approve(address(factory), totalAuctionSupply);
        console2.log("Approved Factory to spend RWA:", totalAuctionSupply);

        // 4. 创建拍卖
        address newAuction = factory.createAuction(params, totalAuctionSupply);

        console2.log("-------------------------------------------");
        console2.log(">>> NEW DUTCH AUCTION CREATED AT:", newAuction);
        console2.log("-------------------------------------------");
        console2.log("Start Time:", params.startTime);
        console2.log("Round Duration:", params.roundDuration);

        vm.stopBroadcast();
    }
}