// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "solmate/tokens/ERC20.sol";
import {Owned} from "solmate/auth/Owned.sol";
import {ReentrancyGuard} from "solmate/utils/ReentrancyGuard.sol";

/// @title OrderBookSettlement
/// @notice 链下订单簿撮合 + 链上结算合约
contract OrderBookSettlement is Owned, ReentrancyGuard {

    // ============ 结构体 ============
    
    struct Order {
        address maker;
        address baseToken;
        address quoteToken;
        uint256 price;
        uint256 amount;
        uint256 filled;
        uint256 nonce;
        uint256 expiry;
        bool isBuy;
        OrderStatus status;
    }

    struct Trade {
        bytes32 buyOrderId;
        bytes32 sellOrderId;
        uint256 amount;
        uint256 price;
        uint256 timestamp;
    }

    struct Market {
        address baseToken;
        address quoteToken;
        uint256 minOrderSize;
        uint256 tickSize;
        bool active;
        uint256 startTime;
        uint256 endTime;
    }

    enum OrderStatus { Open, Filled, Cancelled, Expired }

    // ============ 状态变量 ============
    
    mapping(address => bool) public relayers;
    mapping(bytes32 => Market) public markets;
    mapping(bytes32 => Order) public orders;
    mapping(address => uint256) public userNonces;
    mapping(address => mapping(address => uint256)) public lockedBalances;
    mapping(address => mapping(address => uint256)) public availableBalances;
    
    Trade[] public trades;
    bytes32[] public orderIds;
    bytes32[] public marketIds;

    uint256 public constant PRICE_PRECISION = 1e18;
    
    // ============ 事件 ============
    
    event MarketCreated(bytes32 indexed marketId, address indexed baseToken, address indexed quoteToken);
    event OrderPlaced(bytes32 indexed orderId, bytes32 indexed marketId, address indexed maker, bool isBuy, uint256 price, uint256 amount);
    event OrderCancelled(bytes32 indexed orderId, address indexed maker);
    event TradeExecuted(bytes32 indexed marketId, bytes32 buyOrderId, bytes32 sellOrderId, uint256 amount, uint256 price);
    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount);
    event RelayerUpdated(address indexed relayer, bool status);

    // ============ 修饰器 ============
    
    modifier onlyRelayer() {
        require(relayers[msg.sender] || msg.sender == owner, "Not relayer");
        _;
    }

    // ============ 构造函数 ============
    
    constructor() Owned(msg.sender) {
        relayers[msg.sender] = true;
    }

    // ============ 管理函数 ============
    
    function setRelayer(address relayer, bool status) external onlyOwner {
        relayers[relayer] = status;
        emit RelayerUpdated(relayer, status);
    }
    
    function createMarket(
        address baseToken,
        address quoteToken,
        uint256 minOrderSize,
        uint256 tickSize,
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner returns (bytes32 marketId) {
        require(baseToken != address(0) && quoteToken != address(0), "Invalid tokens");
        require(endTime > startTime, "Invalid time range");
        
        marketId = keccak256(abi.encodePacked(baseToken, quoteToken, block.timestamp));
        
        markets[marketId] = Market({
            baseToken: baseToken,
            quoteToken: quoteToken,
            minOrderSize: minOrderSize,
            tickSize: tickSize,
            active: true,
            startTime: startTime,
            endTime: endTime
        });
        
        marketIds.push(marketId);
        emit MarketCreated(marketId, baseToken, quoteToken);
    }

    // ============ 用户资金操作 ============
    
    function deposit(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        ERC20(token).transferFrom(msg.sender, address(this), amount);
        availableBalances[msg.sender][token] += amount;
        emit Deposit(msg.sender, token, amount);
    }
    
    function withdraw(address token, uint256 amount) external nonReentrant {
        require(availableBalances[msg.sender][token] >= amount, "Insufficient balance");
        availableBalances[msg.sender][token] -= amount;
        ERC20(token).transfer(msg.sender, amount);
        emit Withdraw(msg.sender, token, amount);
    }
    
    function getBalance(address user, address token) external view returns (uint256 available, uint256 locked) {
        return (availableBalances[user][token], lockedBalances[user][token]);
    }

    // ============ 订单操作 ============
    
    function placeOrder(
        bytes32 marketId,
        bool isBuy,
        uint256 price,
        uint256 amount
    ) external nonReentrant returns (bytes32 orderId) {
        Market memory market = markets[marketId];
        require(market.active, "Market not active");
        require(block.timestamp >= market.startTime && block.timestamp < market.endTime, "Market not open");
        require(amount >= market.minOrderSize, "Order too small");
        
        address tokenToLock = isBuy ? market.quoteToken : market.baseToken;
        uint256 amountToLock = isBuy ? (price * amount) / PRICE_PRECISION : amount;
        
        require(availableBalances[msg.sender][tokenToLock] >= amountToLock, "Insufficient balance");
        
        availableBalances[msg.sender][tokenToLock] -= amountToLock;
        lockedBalances[msg.sender][tokenToLock] += amountToLock;
        
        uint256 nonce = userNonces[msg.sender]++;
        orderId = keccak256(abi.encodePacked(msg.sender, nonce, block.timestamp));
        
        orders[orderId] = Order({
            maker: msg.sender,
            baseToken: market.baseToken,
            quoteToken: market.quoteToken,
            price: price,
            amount: amount,
            filled: 0,
            nonce: nonce,
            expiry: market.endTime,
            isBuy: isBuy,
            status: OrderStatus.Open
        });
        
        orderIds.push(orderId);
        emit OrderPlaced(orderId, marketId, msg.sender, isBuy, price, amount);
    }
    
    function cancelOrder(bytes32 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.maker == msg.sender, "Not order maker");
        require(order.status == OrderStatus.Open, "Order not open");
        
        order.status = OrderStatus.Cancelled;
        
        uint256 remaining = order.amount - order.filled;
        address tokenToUnlock = order.isBuy ? order.quoteToken : order.baseToken;
        uint256 amountToUnlock = order.isBuy ? (order.price * remaining) / PRICE_PRECISION : remaining;
        
        lockedBalances[msg.sender][tokenToUnlock] -= amountToUnlock;
        availableBalances[msg.sender][tokenToUnlock] += amountToUnlock;
        
        emit OrderCancelled(orderId, msg.sender);
    }

    // ============ 撮合结算 ============
    
    function settleTrades(
        bytes32[] calldata buyOrderIds,
        bytes32[] calldata sellOrderIds,
        uint256[] calldata amounts,
        uint256[] calldata prices
    ) external onlyRelayer nonReentrant {
        uint256 len = buyOrderIds.length;
        require(len == sellOrderIds.length && len == amounts.length && len == prices.length, "Length mismatch");
        
        for (uint256 i = 0; i < len; i++) {
            _executeTrade(buyOrderIds[i], sellOrderIds[i], amounts[i], prices[i]);
        }
    }
    
    function _executeTrade(bytes32 buyOrderId, bytes32 sellOrderId, uint256 amount, uint256 price) internal {
        Order storage buyOrder = orders[buyOrderId];
        Order storage sellOrder = orders[sellOrderId];
        
        require(buyOrder.status == OrderStatus.Open && sellOrder.status == OrderStatus.Open, "Order not open");
        require(buyOrder.isBuy && !sellOrder.isBuy, "Invalid order types");
        require(buyOrder.baseToken == sellOrder.baseToken, "Token mismatch");
        
        uint256 quoteAmount = (price * amount) / PRICE_PRECISION;
        
        // 更新订单
        buyOrder.filled += amount;
        sellOrder.filled += amount;
        if (buyOrder.filled >= buyOrder.amount) buyOrder.status = OrderStatus.Filled;
        if (sellOrder.filled >= sellOrder.amount) sellOrder.status = OrderStatus.Filled;
        
        // 转移资产
        lockedBalances[buyOrder.maker][buyOrder.quoteToken] -= quoteAmount;
        availableBalances[sellOrder.maker][buyOrder.quoteToken] += quoteAmount;
        lockedBalances[sellOrder.maker][buyOrder.baseToken] -= amount;
        availableBalances[buyOrder.maker][buyOrder.baseToken] += amount;
        
        // 退还买家多付的部分
        uint256 maxQuote = (buyOrder.price * amount) / PRICE_PRECISION;
        if (maxQuote > quoteAmount) {
            uint256 refund = maxQuote - quoteAmount;
            lockedBalances[buyOrder.maker][buyOrder.quoteToken] -= refund;
            availableBalances[buyOrder.maker][buyOrder.quoteToken] += refund;
        }
        
        // 记录成交
        trades.push(Trade(buyOrderId, sellOrderId, amount, price, block.timestamp));
        
        bytes32 marketId = keccak256(abi.encodePacked(buyOrder.baseToken, buyOrder.quoteToken));
        emit TradeExecuted(marketId, buyOrderId, sellOrderId, amount, price);
    }

    // ============ 视图函数 ============
    
    function getOrder(bytes32 orderId) external view returns (Order memory) {
        return orders[orderId];
    }
    
    function getMarket(bytes32 marketId) external view returns (Market memory) {
        return markets[marketId];
    }
    
    function getTradesCount() external view returns (uint256) {
        return trades.length;
    }
    
    function getRecentTrades(uint256 count) external view returns (Trade[] memory) {
        uint256 len = trades.length;
        if (count > len) count = len;
        
        Trade[] memory result = new Trade[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = trades[len - count + i];
        }
        return result;
    }
    
    function getAllMarketIds() external view returns (bytes32[] memory) {
        return marketIds;
    }
}
