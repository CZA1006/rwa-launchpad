import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { OrderBook } from './orderbook.js';
import { MatchingEngine } from './matching.js';
import { SettlementService } from './settlement.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// 初始化订单簿和撮合引擎
const orderBook = new OrderBook();
const matchingEngine = new MatchingEngine(orderBook);
const settlementService = new SettlementService();

// 模拟市场数据
const markets = new Map();
const priceHistory = new Map();

// 初始化模拟市场
function initializeMarket(marketId, baseToken, quoteToken, startPrice) {
  markets.set(marketId, {
    id: marketId,
    baseToken,
    quoteToken,
    startTime: Date.now(),
    endTime: Date.now() + 24 * 60 * 60 * 1000, // 24小时后结束
    lastPrice: startPrice,
    high24h: startPrice,
    low24h: startPrice,
    volume24h: 0,
    change24h: 0
  });
  
  priceHistory.set(marketId, []);
  
  // 生成模拟历史数据
  generatePriceHistory(marketId, startPrice);
}

function generatePriceHistory(marketId, startPrice) {
  const history = [];
  const now = Date.now();
  let price = startPrice;
  
  // 生成过去24小时的模拟数据（每5分钟一个点）
  for (let i = 288; i >= 0; i--) {
    const timestamp = now - i * 5 * 60 * 1000;
    const change = (Math.random() - 0.5) * 0.02 * price; // ±1% 波动
    price = Math.max(price + change, startPrice * 0.5);
    
    history.push({
      timestamp,
      price: parseFloat(price.toFixed(6)),
      volume: Math.random() * 10000
    });
  }
  
  priceHistory.set(marketId, history);
}

// 初始化默认市场 (使用 RWA/GO，GO 充当 USDC)
initializeMarket('RWA-GO', 'RWA', 'GO', 2.5);

// 打印链上结算状态
console.log('========================================');
console.log('Chain Settlement Status:');
console.log('RPC URL:', process.env.RPC_URL || 'Not configured (simulation mode)');
console.log('Contract:', process.env.SETTLEMENT_CONTRACT || 'Not configured');
console.log('========================================');

// REST API 端点

// 获取市场列表
app.get('/api/markets', (req, res) => {
  const marketList = Array.from(markets.values());
  res.json(marketList);
});

// 获取市场详情
app.get('/api/markets/:marketId', (req, res) => {
  const market = markets.get(req.params.marketId);
  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }
  res.json(market);
});

// 获取订单簿
app.get('/api/orderbook/:marketId', (req, res) => {
  const { depth = 20 } = req.query;
  const book = orderBook.getOrderBook(req.params.marketId, parseInt(depth));
  res.json(book);
});

// 获取价格历史
app.get('/api/prices/:marketId', (req, res) => {
  const { interval = '5m', limit = 100 } = req.query;
  const history = priceHistory.get(req.params.marketId) || [];
  res.json(history.slice(-parseInt(limit)));
});

// 获取最近成交
app.get('/api/trades/:marketId', (req, res) => {
  const { limit = 50 } = req.query;
  const trades = orderBook.getRecentTrades(req.params.marketId, parseInt(limit));
  res.json(trades);
});

// 下单 (需要签名验证)
app.post('/api/orders', async (req, res) => {
  try {
    const { marketId, side, price, amount, userAddress, signature } = req.body;
    
    // TODO: 验证签名
    // const isValid = await verifySignature(userAddress, signature, orderData);
    
    const order = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      marketId,
      side, // 'buy' or 'sell'
      price: parseFloat(price),
      amount: parseFloat(amount),
      filled: 0,
      status: 'open',
      userAddress,
      timestamp: Date.now()
    };
    
    // 添加到订单簿
    orderBook.addOrder(order);
    
    // 尝试撮合
    const matches = matchingEngine.match(marketId);
    
    // 如果有成交，提交到链上结算
    if (matches.length > 0) {
      for (const match of matches) {
        // 更新市场数据
        updateMarketData(marketId, match.price, match.amount);
        
        // 广播成交信息
        io.to(marketId).emit('trade', match);
        
        // 添加到结算队列
        await settlementService.addTrade(match);
      }
      
      console.log(`${matches.length} trades matched, added to settlement queue`);
    }
    
    // 广播订单簿更新
    io.to(marketId).emit('orderbook', orderBook.getOrderBook(marketId, 20));
    
    res.json({ success: true, order, matches });
  } catch (error) {
    console.error('Order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 取消订单
app.delete('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userAddress, signature } = req.body;
    
    // TODO: 验证签名
    
    const order = orderBook.cancelOrder(orderId, userAddress);
    
    if (order) {
      io.to(order.marketId).emit('orderbook', orderBook.getOrderBook(order.marketId, 20));
      res.json({ success: true, order });
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户订单
app.get('/api/orders/user/:address', (req, res) => {
  const orders = orderBook.getUserOrders(req.params.address);
  res.json(orders);
});

// ============ 链上结算 API ============

// 手动触发批量结算
app.post('/api/settlement/flush', async (req, res) => {
  try {
    const result = await settlementService.flush();
    res.json(result || { success: true, message: 'No pending trades' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取待结算交易数量
app.get('/api/settlement/pending', (req, res) => {
  res.json({ count: settlementService.getPendingCount() });
});

// 获取结算服务状态
app.get('/api/settlement/status', async (req, res) => {
  const onChainCount = await settlementService.getOnChainTradesCount();
  res.json({
    mode: settlementService.isInitialized ? 'on-chain' : 'simulation',
    contract: process.env.SETTLEMENT_CONTRACT || null,
    rpcUrl: process.env.RPC_URL || null,
    pendingTrades: settlementService.getPendingCount(),
    onChainTrades: onChainCount,
    settledTrades: settlementService.getSettledTrades(10).length
  });
});

// 手动触发撮合
app.post('/api/settlement/match', async (req, res) => {
  try {
    const result = await settlementService.manualMatch();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取已结算交易
app.get('/api/settlement/trades', (req, res) => {
  const { limit = 50 } = req.query;
  const trades = settlementService.getSettledTrades(parseInt(limit));
  res.json(trades);
});

// 更新市场数据
function updateMarketData(marketId, price, volume) {
  const market = markets.get(marketId);
  if (!market) return;
  
  const oldPrice = market.lastPrice;
  market.lastPrice = price;
  market.volume24h += volume * price;
  
  if (price > market.high24h) market.high24h = price;
  if (price < market.low24h) market.low24h = price;
  
  market.change24h = ((price - oldPrice) / oldPrice) * 100;
  
  // 添加到价格历史
  const history = priceHistory.get(marketId) || [];
  history.push({
    timestamp: Date.now(),
    price,
    volume
  });
  
  // 保留最近1000条记录
  if (history.length > 1000) {
    history.shift();
  }
  
  priceHistory.set(marketId, history);
  
  // 广播市场更新
  io.to(marketId).emit('market', market);
}

// WebSocket 连接处理
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // 订阅市场
  socket.on('subscribe', (marketId) => {
    socket.join(marketId);
    console.log(`Client ${socket.id} subscribed to ${marketId}`);
    
    // 发送当前订单簿
    socket.emit('orderbook', orderBook.getOrderBook(marketId, 20));
    
    // 发送市场数据
    const market = markets.get(marketId);
    if (market) {
      socket.emit('market', market);
    }
  });
  
  // 取消订阅
  socket.on('unsubscribe', (marketId) => {
    socket.leave(marketId);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// 模拟价格波动（用于演示）
setInterval(() => {
  markets.forEach((market, marketId) => {
    // 模拟小幅价格波动
    const change = (Math.random() - 0.5) * 0.005 * market.lastPrice;
    const newPrice = Math.max(market.lastPrice + change, 0.01);
    
    // 随机添加一些模拟订单
    if (Math.random() > 0.7) {
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      const priceOffset = (Math.random() - 0.5) * 0.05 * newPrice;
      const orderPrice = parseFloat((newPrice + priceOffset).toFixed(6));
      const amount = parseFloat((Math.random() * 1000 + 100).toFixed(2));
      
      const order = {
        id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        marketId,
        side,
        price: orderPrice,
        amount,
        filled: 0,
        status: 'open',
        userAddress: '0x' + Math.random().toString(16).substr(2, 40),
        timestamp: Date.now()
      };
      
      orderBook.addOrder(order);
      
      // 尝试撮合
      const matches = matchingEngine.match(marketId);
      
      if (matches.length > 0) {
        for (const match of matches) {
          updateMarketData(marketId, match.price, match.amount);
          io.to(marketId).emit('trade', match);
        }
      }
      
      io.to(marketId).emit('orderbook', orderBook.getOrderBook(marketId, 20));
    }
  });
}, 3000);

const PORT = process.env.PORT || 3003;
httpServer.listen(PORT, () => {
  console.log(`🚀 Order book server running on port ${PORT}`);
});

