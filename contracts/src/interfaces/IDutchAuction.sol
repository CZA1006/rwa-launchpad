// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct DutchAuctionParams {
    address currency;           // 支付代币
    address token;              // 销售代币
    address kycHook;            // KYC 钩子
    address recipient;          // 收款方
    
    uint256 totalRounds;        // 总轮数
    uint256 roundDuration;      // 每轮时长
    uint256 supplyPerRound;     // 每轮供给
    
    uint256 startPrice;         // 起拍价
    uint256 floorPrice;         // 底价
    uint256 minIssuance;        // 最小发行量
    uint256 startTime;          // 开始时间
}

interface IDutchAuction {
    function buy(uint256 amount) external;
    function getCurrentPrice() external view returns (uint256);
    function finalize() external; 
    
    // 【新增】退款函数
    function withdrawRefund() external;
    
    event Buy(address indexed buyer, uint256 amount, uint256 price, uint256 cost);
    event AuctionFinalized(uint256 totalSold, uint256 totalRaised, bool success);
    // 【新增】退款事件
    event RefundClaimed(address indexed buyer, uint256 refundAmount, uint256 tokensReturned);
}