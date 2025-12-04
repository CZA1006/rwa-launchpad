// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct DutchAuctionParams {
    address currency;           // 支付代币 (MockUSDC)
    address token;              // 销售代币 (MockRWA)
    address kycHook;            // KYC 验证钩子 (复用!)
    address recipient;          // 收款地址
    
    uint256 totalRounds;        // 总轮数 (例如 48)
    uint256 roundDuration;      // 每轮时长 (例如 1800秒)
    uint256 supplyPerRound;     // 每轮释放多少代币
    
    uint256 startPrice;         // 起拍价 (例如 10.0)
    uint256 floorPrice;         // 底价 (例如 1.0)
    uint256 minIssuance;        // 最小发行量 (风控)
    uint256 startTime;          // 开始时间
}

interface IDutchAuction {
    function buy(uint256 amount) external;
    function getCurrentPrice() external view returns (uint256);
    function finalize() external; // 结算或退款
}