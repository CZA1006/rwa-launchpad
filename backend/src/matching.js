/**
 * 撮合引擎
 * 实现价格优先、时间优先的撮合算法
 */

export class MatchingEngine {
  constructor(orderBook) {
    this.orderBook = orderBook;
    this.pendingSettlements = [];
  }

  /**
   * 执行撮合
   * @param {string} marketId - 市场ID
   * @returns {Array} - 成交记录数组
   */
  match(marketId) {
    const matches = [];
    const book = this.orderBook.books.get(marketId);
    
    if (!book) return matches;

    let iterations = 0;
    const maxIterations = 1000; // 防止无限循环

    while (iterations < maxIterations) {
      iterations++;

      // 获取最优买价和卖价
      const bestBid = this.orderBook.getBestBid(marketId);
      const bestAsk = this.orderBook.getBestAsk(marketId);

      // 如果没有买单或卖单，退出
      if (bestBid === null || bestAsk === null) break;

      // 如果最优买价 < 最优卖价，无法撮合
      if (bestBid < bestAsk) break;

      // 获取该价格的订单
      const bidOrders = this.orderBook.getOrdersAtPrice(marketId, 'buy', bestBid);
      const askOrders = this.orderBook.getOrdersAtPrice(marketId, 'sell', bestAsk);

      if (bidOrders.length === 0 || askOrders.length === 0) break;

      // 获取最早的买单和卖单
      const buyOrder = bidOrders[0];
      const sellOrder = askOrders[0];

      // 计算可成交数量
      const buyRemaining = buyOrder.amount - buyOrder.filled;
      const sellRemaining = sellOrder.amount - sellOrder.filled;
      const matchAmount = Math.min(buyRemaining, sellRemaining);

      if (matchAmount <= 0) break;

      // 成交价格：使用 maker 价格（先挂单的价格）
      // 这里简化处理，使用买卖价格的中间价
      const matchPrice = (bestBid + bestAsk) / 2;

      // 创建成交记录
      const trade = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        marketId,
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        buyer: buyOrder.userAddress,
        seller: sellOrder.userAddress,
        price: matchPrice,
        amount: matchAmount,
        timestamp: Date.now()
      };

      matches.push(trade);
      this.orderBook.addTrade(marketId, trade);

      // 更新订单状态
      buyOrder.filled += matchAmount;
      sellOrder.filled += matchAmount;

      // 移除完全成交的订单
      if (buyOrder.filled >= buyOrder.amount) {
        buyOrder.status = 'filled';
        this.orderBook.removeOrder(buyOrder.id);
      }

      if (sellOrder.filled >= sellOrder.amount) {
        sellOrder.status = 'filled';
        this.orderBook.removeOrder(sellOrder.id);
      }

      // 添加到待结算队列
      this.pendingSettlements.push(trade);
    }

    return matches;
  }

  /**
   * 获取待结算交易
   */
  getPendingSettlements() {
    const settlements = [...this.pendingSettlements];
    this.pendingSettlements = [];
    return settlements;
  }

  /**
   * 模拟市场订单（立即成交）
   */
  executeMarketOrder(marketId, side, amount, userAddress) {
    const matches = [];
    let remainingAmount = amount;
    const book = this.orderBook.books.get(marketId);

    if (!book) return { matches, remainingAmount };

    const oppositeSide = side === 'buy' ? 'asks' : 'bids';
    const priceMap = book[oppositeSide];

    // 按价格排序
    const prices = Array.from(priceMap.keys()).sort((a, b) => 
      side === 'buy' ? a - b : b - a
    );

    for (const price of prices) {
      if (remainingAmount <= 0) break;

      const orders = priceMap.get(price);
      
      for (const order of orders) {
        if (remainingAmount <= 0) break;

        const available = order.amount - order.filled;
        const matchAmount = Math.min(available, remainingAmount);

        if (matchAmount > 0) {
          const trade = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            marketId,
            buyOrderId: side === 'buy' ? 'market' : order.id,
            sellOrderId: side === 'sell' ? 'market' : order.id,
            buyer: side === 'buy' ? userAddress : order.userAddress,
            seller: side === 'sell' ? userAddress : order.userAddress,
            price,
            amount: matchAmount,
            timestamp: Date.now()
          };

          matches.push(trade);
          this.orderBook.addTrade(marketId, trade);

          order.filled += matchAmount;
          remainingAmount -= matchAmount;

          if (order.filled >= order.amount) {
            order.status = 'filled';
            this.orderBook.removeOrder(order.id);
          }

          this.pendingSettlements.push(trade);
        }
      }
    }

    return { matches, remainingAmount };
  }
}

