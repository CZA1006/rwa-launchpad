const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");

async function main() {
  // 1. 读取数据
  if (!fs.existsSync("deployments.json") || !fs.existsSync("bots.json")) {
      console.error("❌ 缺少配置文件 (deployments.json 或 bots.json)");
      return;
  }
  const deployData = JSON.parse(fs.readFileSync("deployments.json"));
  const botsData = JSON.parse(fs.readFileSync("bots.json"));
  
  console.log(`🚀 [3] 开始模拟竞拍 - 机器人数量: ${botsData.length}`);
  console.log(`   目标拍卖 ID: ${deployData.auctionId}`);

  // 获取合约 ABI
  const EasyAuction = await ethers.getContractFactory("EasyAuction");
  const ERC20 = await ethers.getContractFactory("ERC20Mintable");

  // 遍历所有机器人执行操作
  for (let i = 0; i < botsData.length; i++) {
      const botInfo = botsData[i];
      // 使用机器人的私钥连接 Provider
      const botWallet = new ethers.Wallet(botInfo.privateKey, ethers.provider);
      
      console.log(`\n🤖 [Bot ${i+1}] ${botInfo.address} 正在行动...`);

      // 连接合约
      const botUsdt = ERC20.attach(deployData.biddingToken).connect(botWallet);
      const botAuction = EasyAuction.attach(deployData.easyAuction).connect(botWallet);

      try {
          // 1. 授权 (Approve)
          // 检查余额
          const bal = await botUsdt.balanceOf(botInfo.address);
          console.log(`   💰 余额: ${ethers.utils.formatEther(bal)} mUSDT`);
          
          if (bal.eq(0)) {
              console.log("   ⚠️ 余额不足，跳过");
              continue;
          }

          console.log("   🔓 正在授权...");
          const txApprove = await botUsdt.approve(deployData.easyAuction, ethers.constants.MaxUint256);
          await txApprove.wait();

          // 2. 随机出价策略
          // 随机买 10 ~ 100 个 PROJ
          const buyAmount = ethers.utils.parseEther((Math.floor(Math.random() * 90) + 10).toString());
          // 随机出价 0.5 ~ 2.0 U/个 -> 总价 = buyAmount * price
          const randomPrice = (Math.random() * 1.5) + 0.5; 
          // 为了简单，我们直接设置 sellAmount (愿意付出的 USDT 总额)
          // 比如: 想要买 10 个，单价 1 U，那就出 10 U
          const sellAmountRaw = parseFloat(ethers.utils.formatEther(buyAmount)) * randomPrice;
          const sellAmount = ethers.utils.parseEther(sellAmountRaw.toFixed(2));

          console.log(`   💸 出价: 买 ${ethers.utils.formatEther(buyAmount)} PROJ, 付 ${ethers.utils.formatEther(sellAmount)} mUSDT (均价: $${randomPrice.toFixed(2)})`);

          // 3. 下单
          const txBid = await botAuction.placeSellOrders(
              deployData.auctionId,
              [buyAmount],
              [sellAmount],
              ["0x0000000000000000000000000000000000000000000000000000000000000001"],
              "0x"
          );
          await txBid.wait();
          console.log("   ✅ 下单成功!");

      } catch (err) {
          console.error(`   ❌ 失败: ${err.message}`);
      }
  }

  console.log("\n✅ 所有机器人行动结束。");
}

main().catch((error) => { console.error(error); process.exit(1); });