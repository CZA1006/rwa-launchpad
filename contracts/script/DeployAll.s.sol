// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {OrderBookSettlement} from "../src/OrderBookSettlement.sol";
import {GOToken, RWAToken} from "../src/mock/MockTokens.sol";

contract DeployAll is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy tokens
        GOToken goToken = new GOToken();
        console.log("GO Token deployed to:", address(goToken));
        
        RWAToken rwaToken = new RWAToken();
        console.log("RWA Token deployed to:", address(rwaToken));
        
        // 2. Deploy settlement contract
        OrderBookSettlement settlement = new OrderBookSettlement();
        console.log("OrderBookSettlement deployed to:", address(settlement));
        
        // 3. Create trading market (RWA/GO)
        uint256 startTime = block.timestamp;
        uint256 endTime = block.timestamp + 30 days;
        
        bytes32 marketId = settlement.createMarket(
            address(rwaToken),
            address(goToken),
            1e15,
            1e15,
            startTime,
            endTime
        );
        console.log("Market created, ID:");
        console.logBytes32(marketId);
        
        // 4. Mint tokens to test accounts
        address[] memory testAccounts = new address[](3);
        testAccounts[0] = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        testAccounts[1] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        testAccounts[2] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
        
        for (uint i = 0; i < testAccounts.length; i++) {
            goToken.mint(testAccounts[i], 100_000 * 1e18);
            rwaToken.mint(testAccounts[i], 10_000 * 1e18);
            console.log("Minted tokens to:", testAccounts[i]);
        }
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("========================================");
        console.log("        DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("GO Token:", address(goToken));
        console.log("RWA Token:", address(rwaToken));
        console.log("Settlement Contract:", address(settlement));
        console.log("========================================");
    }
}
