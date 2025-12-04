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

    bool public finalized;
    bool public failed; 

    event Buy(address indexed buyer, uint256 amount, uint256 price, uint256 cost);
    event AuctionFinalized(uint256 totalSold, uint256 totalRaised, bool success);

    constructor(DutchAuctionParams memory _params) Owned(msg.sender) {
        params = _params;
    }

    function getCurrentPrice() public view returns (uint256) {
        if (block.timestamp < params.startTime) return params.startPrice;
        
        uint256 elapsed = block.timestamp - params.startTime;
        uint256 roundIndex = elapsed / params.roundDuration;
        
        if (roundIndex >= params.totalRounds) return params.floorPrice;

        uint256 timeInRound = elapsed % params.roundDuration;
        // 线性衰减公式
        uint256 priceDropTotal = params.startPrice - params.floorPrice;
        uint256 currentDrop = (priceDropTotal * timeInRound) / params.roundDuration;

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
        
        // --- 关键修复：精度处理 ---
        // 1. 原始成本 (18 decimals precision)
        uint256 rawCost = (price * amount) / 1e18; 
        
        // 2. 转换成本到 USDC 精度 (6 decimals)
        // 假设 currency 是 USDC (6 decimals)，我们需要除以 1e12
        // 如果 currency 是 ETH/DAI (18 decimals)，则不需要除
        // 为了 MVP，我们这里硬编码适配 USDC
        uint256 cost = rawCost / 1e12; 

        // 安全检查：如果买的数量太少导致 cost 为 0，则 revert
        if (cost == 0 && rawCost > 0) revert("Amount too small");

        if (params.kycHook != address(0)) {
            IValidationHook(params.kycHook).validateBid(msg.sender, amount, price);
        }

        // 收钱 (USDC 6 decimals)
        ERC20(params.currency).transferFrom(msg.sender, address(this), cost);
        // 发货 (RWA 18 decimals)
        ERC20(params.token).transfer(msg.sender, amount);

        totalSold += amount;
        totalRaised += cost;
        soldInRound[roundIndex] += amount;

        emit Buy(msg.sender, amount, price, cost);
    }

    function finalize() external onlyOwner {
        require(!finalized, "Already Finalized");
        finalized = true;

        if (totalSold < params.minIssuance) {
            failed = true;
        } else {
            uint256 balance = ERC20(params.currency).balanceOf(address(this));
            ERC20(params.currency).transfer(params.recipient, balance);
            
            uint256 tokenBalance = ERC20(params.token).balanceOf(address(this));
            if (tokenBalance > 0) {
                ERC20(params.token).transfer(params.recipient, tokenBalance);
            }
        }
        
        emit AuctionFinalized(totalSold, totalRaised, !failed);
    }
}