const hre = require("hardhat");
const { ethers } = hre;

// 🟢 配置区域：请填入你之前部署获得的地址
const EASY_AUCTION_ADDRESS = "0x1B01a9Bb95A52F269426b32a5B2a5473Df30D1Bd"; // <--- 替换这里！
const AUCTION_ID = 1;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 正在尝试结算拍卖，操作账户:", deployer.address);

  // 1. 连接 EasyAuction 合约
  const EasyAuction = await ethers.getContractFactory("EasyAuction");
  const easyAuction = EasyAuction.attach(EASY_AUCTION_ADDRESS);

  // 2. 检查拍卖状态
  const auctionData = await easyAuction.auctionData(AUCTION_ID);
  const auctionEndDate = auctionData.auctionEndDate;
  const currentTimestamp = (await ethers.provider.getBlock("latest")).timestamp;

  console.log(`\n当前时间戳: ${currentTimestamp}`);
  console.log(`拍卖结束时间: ${auctionEndDate}`);

  if (currentTimestamp < auctionEndDate) {
    const waitSeconds = auctionEndDate - currentTimestamp;
    console.log(`\n❌ 拍卖尚未结束！无法结算。`);
    console.log(`⏳ 请再等待约 ${Math.ceil(waitSeconds / 60)} 分钟。`);
    return;
  }

  // 3. 检查是否已经结算过
  if (auctionData.clearingPriceOrder !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    console.log("\n⚠️ 该拍卖已经结算过了，无需重复操作。");
    return;
  }

  // 4. 执行结算
  console.log("\n⚡️ 正在执行 settleAuction...");
  try {
    // 任何人都可以调用这个函数，通常由发行方调用
    const tx = await easyAuction.settleAuction(AUCTION_ID);
    console.log("⏳ 交易发送成功，等待上链...");
    const receipt = await tx.wait();
    
    // 5. 解析结果
    // 查找 AuctionCleared 事件
    const event = receipt.events.find(e => e.event === 'AuctionCleared');
    if (event) {
        console.log(`\n🎉🎉 结算成功！`);
        console.log(`-------------------------------------------`);
        console.log(`卖出的代币数量: ${ethers.utils.formatEther(event.args.soldAuctioningTokens)} PROJ`);
        console.log(`募集的资金总额: ${ethers.utils.formatEther(event.args.soldBiddingTokens)} mUSDT`);
        console.log(`清算价格订单: ${event.args.clearingPriceOrder}`);
        console.log(`-------------------------------------------`);
        console.log(`资金已自动转入你的钱包。买家现在可以 Claim 代币了。`);
    }

  } catch (error) {
    console.error("\n❌ 结算失败:", error.message);
    if (error.message.includes("Auction not yet finished")) {
        console.log("原因：时间还没到。");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });