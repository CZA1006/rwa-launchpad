// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "solmate/tokens/ERC20.sol";
import {Owned} from "solmate/auth/Owned.sol";
import {IDutchAuction, DutchAuctionParams} from "./interfaces/IDutchAuction.sol";

interface IValidationHook {
    function validateBid(address bidder, uint256 amount, uint256 price) external view returns (bytes4);
}

contract DutchAuction is IDutchAuction, Owned {
    DutchAuctionParams public params;
    
    uint256 public totalSold;           
    uint256 public totalRaised;         
    mapping(uint256 => uint256) public soldInRound; 

    // 记录用户账本，用于退款
    mapping(address => uint256) public userCost;   // 用户总共花了多少 USDC
    mapping(address => uint256) public userBought; // 用户总共买了多少 RWA

    bool public finalized;
    bool public failed; 

    // 【修正】删除了这里的 event 定义，因为它们已经从 IDutchAuction 继承了

    constructor(DutchAuctionParams memory _params) Owned(msg.sender) {
        params = _params;
    }

    function getCurrentPrice() public view returns (uint256) {
        if (block.timestamp < params.startTime) return params.startPrice;
        
        uint256 elapsed = block.timestamp - params.startTime;
        uint256 roundIndex = elapsed / params.roundDuration;
        
        if (roundIndex >= params.totalRounds) return params.floorPrice;

        uint256 timeInRound = elapsed % params.roundDuration;
        uint256 priceDropRange = params.startPrice - params.floorPrice;
        uint256 currentDrop = (priceDropRange * timeInRound) / params.roundDuration;

        return params.startPrice - currentDrop;
    }

    function buy(uint256 amount) external {
        require(!finalized, "Auction Ended");
        require(block.timestamp >= params.startTime, "Not Started");

        uint256 elapsed = block.timestamp - params.startTime;
        uint256 roundIndex = elapsed / params.roundDuration;
        require(roundIndex < params.totalRounds, "Auction Expired");
        require(soldInRound[roundIndex] + amount <= params.supplyPerRound, "Round Sold Out");

        uint256 price = getCurrentPrice();
        
        // 精度处理: 18 decimals -> 6 decimals (USDC)
        uint256 rawCost = (price * amount) / 1e18; 
        uint256 cost = rawCost / 1e12; 

        if (cost == 0 && rawCost > 0) revert("Amount too small");

        if (params.kycHook != address(0)) {
            IValidationHook(params.kycHook).validateBid(msg.sender, amount, price);
        }

        ERC20(params.currency).transferFrom(msg.sender, address(this), cost);
        ERC20(params.token).transfer(msg.sender, amount);

        totalSold += amount;
        totalRaised += cost;
        soldInRound[roundIndex] += amount;
        
        // 更新个人账本
        userCost[msg.sender] += cost;
        userBought[msg.sender] += amount;

        emit Buy(msg.sender, amount, price, cost);
    }

    // --- 退款逻辑 ---
    function withdrawRefund() external {
        require(finalized, "Auction not finalized");
        require(failed, "Auction succeeded, no refund");
        
        uint256 refundAmount = userCost[msg.sender];
        uint256 returnTokens = userBought[msg.sender];
        
        require(refundAmount > 0, "Nothing to refund");

        // 防止重入：先清零状态
        userCost[msg.sender] = 0;
        userBought[msg.sender] = 0;

        // 1. 回收 RWA 代币 (需用户先 Approve)
        ERC20(params.token).transferFrom(msg.sender, address(this), returnTokens);

        // 2. 退还 USDC
        ERC20(params.currency).transfer(msg.sender, refundAmount);

        emit RefundClaimed(msg.sender, refundAmount, returnTokens);
    }

    function finalize() external onlyOwner {
        require(!finalized, "Already Finalized");
        finalized = true;

        if (totalSold < params.minIssuance) {
            failed = true;
            // 失败：剩余未卖出的 RWA 退还给项目方
            uint256 unsoldTokens = ERC20(params.token).balanceOf(address(this));
            if (unsoldTokens > 0) {
                ERC20(params.token).transfer(params.recipient, unsoldTokens);
            }
        } else {
            // 成功：提走募集的 USDC
            uint256 balance = ERC20(params.currency).balanceOf(address(this));
            ERC20(params.currency).transfer(params.recipient, balance);
            
            // 提走剩余 RWA
            uint256 tokenBalance = ERC20(params.token).balanceOf(address(this));
            if (tokenBalance > 0) {
                ERC20(params.token).transfer(params.recipient, tokenBalance);
            }
        }
        
        emit AuctionFinalized(totalSold, totalRaised, !failed);
    }
}