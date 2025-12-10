/**
 * 订单簿数据结构
 * 使用红黑树或有序Map来维护价格优先级
 */

export class OrderBook {
  constructor() {
    // marketId => { bids: Map<price, Order[]>, asks: Map<price, Order[]> }
    this.books = new Map();
    // orderId => Order
    this.orders = new Map();
    // marketId => Trade[]
    this.trades = new Map();
  }

  // 获取或创建市场订单簿
  getOrCreateBook(marketId) {
    if (!this.books.has(marketId)) {
      this.books.set(marketId, {
        bids: new Map(), // 买单 (价格从高到低排序)
        asks: new Map()  // 卖单 (价格从低到高排序)
      });
      this.trades.set(marketId, []);
    }
    return this.books.get(marketId);
  }

  // 添加订单
  addOrder(order) {
    const book = this.getOrCreateBook(order.marketId);
    const side = order.side === 'buy' ? 'bids' : 'asks';
    const priceLevel = book[side];

    // 将订单添加到价格层级
    if (!priceLevel.has(order.price)) {
      priceLevel.set(order.price, []);
    }
    priceLevel.get(order.price).push(order);

    // 保存订单引用
    this.orders.set(order.id, order);

    return order;
  }

  // 移除订单
  removeOrder(orderId) {
    const order = this.orders.get(orderId);
    if (!order) return null;

    const book = this.books.get(order.marketId);
    if (!book) return null;

    const side = order.side === 'buy' ? 'bids' : 'asks';
    const priceLevel = book[side].get(order.price);

    if (priceLevel) {
      const index = priceLevel.findIndex(o => o.id === orderId);
      if (index !== -1) {
        priceLevel.splice(index, 1);
        if (priceLevel.length === 0) {
          book[side].delete(order.price);
        }
      }
    }

    this.orders.delete(orderId);
    return order;
  }

  // 取消订单
  cancelOrder(orderId, userAddress) {
    const order = this.orders.get(orderId);
    if (!order || order.userAddress !== userAddress) {
      return null;
    }

    order.status = 'cancelled';
    return this.removeOrder(orderId);
  }

  // 更新订单
  updateOrder(orderId, updates) {
    const order = this.orders.get(orderId);
    if (!order) return null;

    Object.assign(order, updates);

    // 如果完全成交，移除订单
    if (order.filled >= order.amount) {
      order.status = 'filled';
      this.removeOrder(orderId);
    }

    return order;
  }

  // 获取最优买价
  getBestBid(marketId) {
    const book = this.books.get(marketId);
    if (!book || book.bids.size === 0) return null;

    const prices = Array.from(book.bids.keys()).sort((a, b) => b - a);
    return prices[0];
  }

  // 获取最优卖价
  getBestAsk(marketId) {
    const book = this.books.get(marketId);
    if (!book || book.asks.size === 0) return null;

    const prices = Array.from(book.asks.keys()).sort((a, b) => a - b);
    return prices[0];
  }

  // 获取订单簿快照
  getOrderBook(marketId, depth = 20) {
    const book = this.getOrCreateBook(marketId);

    // 聚合买单
    const bids = [];
    const bidPrices = Array.from(book.bids.keys()).sort((a, b) => b - a);
    for (const price of bidPrices.slice(0, depth)) {
      const orders = book.bids.get(price);
      const totalAmount = orders.reduce((sum, o) => sum + (o.amount - o.filled), 0);
      bids.push({
        price,
        amount: totalAmount,
        orders: orders.length
      });
    }

    // 聚合卖单
    const asks = [];
    const askPrices = Array.from(book.asks.keys()).sort((a, b) => a - b);
    for (const price of askPrices.slice(0, depth)) {
      const orders = book.asks.get(price);
      const totalAmount = orders.reduce((sum, o) => sum + (o.amount - o.filled), 0);
      asks.push({
        price,
        amount: totalAmount,
        orders: orders.length
      });
    }

    return {
      bids,
      asks,
      timestamp: Date.now()
    };
  }

  // 获取用户订单
  getUserOrders(userAddress) {
    return Array.from(this.orders.values())
      .filter(o => o.userAddress.toLowerCase() === userAddress.toLowerCase() && o.status === 'open');
  }

  // 添加成交记录
  addTrade(marketId, trade) {
    if (!this.trades.has(marketId)) {
      this.trades.set(marketId, []);
    }
    this.trades.get(marketId).push(trade);

    // 保留最近1000条
    const trades = this.trades.get(marketId);
    if (trades.length > 1000) {
      trades.shift();
    }
  }

  // 获取最近成交
  getRecentTrades(marketId, limit = 50) {
    const trades = this.trades.get(marketId) || [];
    return trades.slice(-limit).reverse();
  }

  // 获取指定价格层级的订单
  getOrdersAtPrice(marketId, side, price) {
    const book = this.books.get(marketId);
    if (!book) return [];

    const sideBook = side === 'buy' ? book.bids : book.asks;
    return sideBook.get(price) || [];
  }
}

