// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {MockRWA} from "../src/mock/MockTokens.sol";

contract FundAuction is Script {
    // ⚠️ 需要手动更新
    address constant AUCTION_ADDRESS = 0x9722839353F9CC010A57b7763C535700b0470389; 
    address constant MOCK_RWA = 0x0165878A594ca255338adfa4d48449f69242Eb8F;
    uint256 constant AUCTION_SUPPLY = 1_000_000 * 1e18; 

    function run() external {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        MockRWA(MOCK_RWA).transfer(AUCTION_ADDRESS, AUCTION_SUPPLY);
        console2.log("Successfully funded Auction:", AUCTION_ADDRESS);
        vm.stopBroadcast();
    }
}