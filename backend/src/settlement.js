/**
 * 链上结算服务
 * 负责监听链上订单事件，执行撮合，并提交链上结算
 */

import { ethers } from 'ethers';

// 结算合约ABI
const SETTLEMENT_ABI = [
  // 函数
  "function settleTrades(bytes32[] calldata buyOrderIds, bytes32[] calldata sellOrderIds, uint256[] calldata amounts, uint256[] calldata prices) external",
  "function getOrder(bytes32 orderId) external view returns (tuple(address maker, address baseToken, address quoteToken, uint256 price, uint256 amount, uint256 filled, uint256 nonce, uint256 expiry, bool isBuy, uint8 status))",
  "function getTradesCount() external view returns (uint256)",
  "function getAllMarketIds() external view returns (bytes32[])",
  "function getRecentTrades(uint256 count) external view returns (tuple(bytes32 buyOrderId, bytes32 sellOrderId, uint256 amount, uint256 price, uint256 timestamp)[])",
  // 事件
  "event OrderPlaced(bytes32 indexed orderId, bytes32 indexed marketId, address indexed maker, bool isBuy, uint256 price, uint256 amount)",
  "event OrderCancelled(bytes32 indexed orderId, address indexed maker)",
  "event TradeExecuted(bytes32 indexed marketId, bytes32 buyOrderId, bytes32 sellOrderId, uint256 amount, uint256 price)"
];

// 配置
const BATCH_SIZE = 5;           // 积累多少笔交易后批量上链
const BATCH_INTERVAL = 30000;   // 或者每30秒强制上链一次

export class SettlementService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.onChainOrders = new Map();
    this.pendingTrades = [];      // 待上链的交易
    this.settledTrades = [];      // 已上链的交易
    this.isInitialized = false;
    this.isProcessing = false;    // 防止重复提交
    
    this.initialize();
  }

  async initialize() {
    const rpcUrl = process.env.RPC_URL;
    const privateKey = process.env.RELAYER_PRIVATE_KEY;
    const contractAddress = process.env.SETTLEMENT_CONTRACT;

    if (!rpcUrl || !privateKey || !contractAddress || 
        contractAddress === '0x0000000000000000000000000000000000000000') {
      console.log('⚠️  Settlement service running in SIMULATION mode');
      console.log('   (Configure RPC_URL, RELAYER_PRIVATE_KEY, SETTLEMENT_CONTRACT to enable on-chain)');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(contractAddress, SETTLEMENT_ABI, this.signer);
      
      console.log('========================================');
      console.log('🔗 Settlement Service Connected');
      console.log('  Contract:', contractAddress);
      console.log('  Relayer:', this.signer.address);
      console.log('  Batch Size:', BATCH_SIZE);
      console.log('  Batch Interval:', BATCH_INTERVAL / 1000, 'seconds');
      console.log('========================================');

      // 监听链上事件
      await this.startEventListeners();
      this.isInitialized = true;

      // 启动定时批量结算
      this.startBatchTimer();

    } catch (error) {
      console.error('Failed to initialize settlement service:', error.message);
    }
  }

  // 定时批量结算
  startBatchTimer() {
    setInterval(async () => {
      if (this.pendingTrades.length > 0) {
        console.log(`\n⏰ Batch timer triggered, ${this.pendingTrades.length} pending trades`);
        await this.flushToChain();
      }
    }, BATCH_INTERVAL);
  }

  async startEventListeners() {
    if (!this.contract) return;

    console.log('📡 Starting event listeners...');

    // 监听新订单事件
    this.contract.on('OrderPlaced', async (orderId, marketId, maker, isBuy, price, amount, event) => {
      console.log(`\n📥 [On-Chain Event] Order Placed:`);
      console.log(`  Order ID: ${orderId.slice(0, 18)}...`);
      console.log(`  Maker: ${maker}`);
      console.log(`  Side: ${isBuy ? 'BUY' : 'SELL'}`);
      console.log(`  Price: ${ethers.formatEther(price)} GO`);
      console.log(`  Amount: ${ethers.formatEther(amount)} RWA`);
    });

    // 监听成交事件
    this.contract.on('TradeExecuted', (marketId, buyOrderId, sellOrderId, amount, price) => {
      console.log(`\n✅ [On-Chain Event] Trade Executed:`);
      console.log(`  Amount: ${ethers.formatEther(amount)} RWA`);
      console.log(`  Price: ${ethers.formatEther(price)} GO`);
      console.log(`  Buy Order: ${buyOrderId.slice(0, 18)}...`);
      console.log(`  Sell Order: ${sellOrderId.slice(0, 18)}...`);
    });

    console.log('📡 Event listeners started');
  }

  // 添加交易到待处理队列
  async addTrade(trade) {
    console.log(`📝 Recording trade: ${trade.amount.toFixed(4)} RWA @ ${trade.price.toFixed(6)} GO`);
    
    // 生成订单 ID（模拟链上订单 ID）
    const buyOrderId = ethers.keccak256(
      ethers.toUtf8Bytes(`buy-${trade.buyOrderId || trade.id}-${Date.now()}`)
    );
    const sellOrderId = ethers.keccak256(
      ethers.toUtf8Bytes(`sell-${trade.sellOrderId || trade.id}-${Date.now()}`)
    );

    this.pendingTrades.push({
      ...trade,
      buyOrderId,
      sellOrderId,
      addedAt: Date.now()
    });

    console.log(`   Pending queue: ${this.pendingTrades.length}/${BATCH_SIZE}`);

    // 如果达到批量大小，立即提交
    if (this.pendingTrades.length >= BATCH_SIZE) {
      console.log(`\n📦 Batch size reached, submitting to chain...`);
      await this.flushToChain();
    }

    return { success: true, pending: this.pendingTrades.length };
  }

  // 批量提交到链上
  async flushToChain() {
    if (!this.isInitialized) {
      console.log('⚠️  Settlement not initialized, skipping on-chain submission');
      // 在模拟模式下，也要记录已结算
      const trades = [...this.pendingTrades];
      this.pendingTrades = [];
      trades.forEach(t => {
        this.settledTrades.push({
          ...t,
          mode: 'simulation',
          settledAt: Date.now()
        });
      });
      return { success: true, mode: 'simulation', count: trades.length };
    }

    if (this.isProcessing) {
      console.log('⏳ Already processing, skipping...');
      return { success: false, error: 'Already processing' };
    }

    if (this.pendingTrades.length === 0) {
      console.log('📭 No pending trades to settle');
      return { success: true, count: 0 };
    }

    this.isProcessing = true;
    const trades = [...this.pendingTrades];
    this.pendingTrades = [];

    try {
      const buyOrderIds = trades.map(t => t.buyOrderId);
      const sellOrderIds = trades.map(t => t.sellOrderId);
      const amounts = trades.map(t => ethers.parseEther(t.amount.toString()));
      const prices = trades.map(t => ethers.parseEther(t.price.toString()));

      console.log(`\n🚀 ========== SUBMITTING TO CHAIN ==========`);
      console.log(`   Trades: ${trades.length}`);
      console.log(`   Total Volume: ${trades.reduce((sum, t) => sum + t.amount, 0).toFixed(4)} RWA`);

      const tx = await this.contract.settleTrades(
        buyOrderIds,
        sellOrderIds,
        amounts,
        prices,
        { gasLimit: 500000n + BigInt(trades.length * 50000) }
      );

      console.log(`   TX Hash: ${tx.hash}`);
      console.log(`   Waiting for confirmation...`);
      
      const receipt = await tx.wait();
      
      console.log(`   ✅ CONFIRMED in block ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`🚀 ==========================================\n`);

      // 记录已结算交易
      trades.forEach(t => {
        this.settledTrades.push({
          ...t,
          mode: 'on-chain',
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          settledAt: Date.now()
        });
      });

      this.isProcessing = false;
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        tradesCount: trades.length,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      console.error(`\n❌ Settlement FAILED:`, error.message);
      
      // 失败的交易放回队列
      this.pendingTrades = [...trades, ...this.pendingTrades];
      console.log(`   Trades returned to pending queue: ${this.pendingTrades.length}`);
      
      this.isProcessing = false;
      return { success: false, error: error.message };
    }
  }

  // 手动刷新（兼容旧接口）
  async flush() {
    return await this.flushToChain();
  }

  // 手动触发撮合
  async manualMatch() {
    if (!this.contract) {
      return { success: false, error: 'Not connected to chain' };
    }

    try {
      const marketIds = await this.contract.getAllMarketIds();
      console.log(`\n🔄 Manual match triggered for ${marketIds.length} markets`);
      return { success: true, marketsChecked: marketIds.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 获取待处理数量
  getPendingCount() {
    return this.pendingTrades.length;
  }

  // 获取已结算交易
  getSettledTrades(limit = 50) {
    return this.settledTrades.slice(-limit);
  }

  // 获取链上成交数量
  async getOnChainTradesCount() {
    if (!this.contract) {
      return { count: 0, source: 'not-connected' };
    }
    
    try {
      const count = await this.contract.getTradesCount();
      return { count: Number(count), source: 'on-chain' };
    } catch (error) {
      return { count: 0, source: 'error', error: error.message };
    }
  }

  // 获取链上最近成交
  async getOnChainRecentTrades(limit = 10) {
    if (!this.contract) return [];
    
    try {
      const trades = await this.contract.getRecentTrades(limit);
      return trades.map(t => ({
        buyOrderId: t.buyOrderId,
        sellOrderId: t.sellOrderId,
        amount: ethers.formatEther(t.amount),
        price: ethers.formatEther(t.price),
        timestamp: Number(t.timestamp)
      }));
    } catch (error) {
      console.error('Error fetching on-chain trades:', error.message);
      return [];
    }
  }
}
