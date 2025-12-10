// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {OrderBookSettlement} from "../src/OrderBookSettlement.sol";

contract CreateOrderBookMarket is Script {
    // 更新为实际部署的地址
    address constant SETTLEMENT = address(0); // TODO: 填入部署后的地址
    address constant RWA_TOKEN = address(0);  // TODO: 填入RWA代币地址
    address constant USDC = address(0);       // TODO: 填入USDC地址

    function run() external {
        require(SETTLEMENT != address(0), "Update SETTLEMENT address");
        require(RWA_TOKEN != address(0), "Update RWA_TOKEN address");
        require(USDC != address(0), "Update USDC address");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        OrderBookSettlement settlement = OrderBookSettlement(SETTLEMENT);
        
        // 创建 RWA/USDC 市场
        bytes32 marketId = settlement.createMarket(
            RWA_TOKEN,                      // baseToken
            USDC,                           // quoteToken
            1e18,                           // minOrderSize: 1 RWA
            1e12,                           // tickSize: 0.000001 USDC (6 decimals)
            block.timestamp,                // startTime: 现在
            block.timestamp + 7 days        // endTime: 7天后
        );
        
        console.log("========== MARKET CREATED ==========");
        console.log("Market ID:", vm.toString(marketId));
        console.log("Base Token (RWA):", RWA_TOKEN);
        console.log("Quote Token (USDC):", USDC);
        console.log("Start Time:", block.timestamp);
        console.log("End Time:", block.timestamp + 7 days);
        console.log("=====================================");
        
        vm.stopBroadcast();
    }
}

