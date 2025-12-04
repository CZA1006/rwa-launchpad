// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {DutchAuction} from "./DutchAuction.sol";
import {DutchAuctionParams} from "./interfaces/IDutchAuction.sol";
import {ERC20} from "solmate/tokens/ERC20.sol";

contract DutchAuctionFactory {
    event DutchAuctionCreated(address indexed auction, address indexed token);

    // 创建一场新的荷式拍卖
    function createAuction(
        DutchAuctionParams memory params,
        uint256 totalTokenSupply // 需要注入的总代币量 (Factory 会自动拉取)
    ) external returns (address auctionAddr) {
        
        // 1. 部署新合约
        DutchAuction auction = new DutchAuction(params);
        auctionAddr = address(auction);

        // 2. 资金注入 (Deployer -> Auction)
        // 前提：Deployer 必须先 Approve 这个 Factory 合约
        ERC20(params.token).transferFrom(msg.sender, auctionAddr, totalTokenSupply);

        // 3. 移交权限 (Ownership) 给部署者，方便后续 finalize
        auction.transferOwnership(msg.sender);

        emit DutchAuctionCreated(auctionAddr, params.token);
    }
}