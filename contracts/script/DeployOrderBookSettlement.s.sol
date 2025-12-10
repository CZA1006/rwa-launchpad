// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {OrderBookSettlement} from "../src/OrderBookSettlement.sol";

contract DeployOrderBookSettlement is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 部署结算合约
        OrderBookSettlement settlement = new OrderBookSettlement();
        
        console.log("========== DEPLOYMENT COMPLETE ==========");
        console.log("OrderBookSettlement deployed to:", address(settlement));
        console.log("Owner:", settlement.owner());
        console.log("==========================================");
        
        vm.stopBroadcast();
    }
}

