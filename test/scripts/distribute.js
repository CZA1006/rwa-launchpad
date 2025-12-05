const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");

// 🔥 配置区域
const REAL_USERS = [
    "0x7c2ed23f50d495bc8c347230af03deba66638773", 
    // 在这里粘贴你想测试的真实钱包地址
];
const NUM_BOTS_TO_CREATE = 10000; // 你想模拟多少个机器人？(例如 10 个或 100 个)
const USDT_AMOUNT = ethers.utils.parseEther("1000"); // 给每人 1000 U
const ETH_AMOUNT = ethers.utils.parseEther("0.002"); // 给机器人 0.002 ETH 做 Gas

async function main() {
  // 1. 读取部署信息
  if (!fs.existsSync("deployments.json")) {
      console.error("❌ 找不到 deployments.json，请先运行部署脚本！");
      return;
  }
  const deployData = JSON.parse(fs.readFileSync("deployments.json"));
  const [deployer] = await ethers.getSigners();
  
  console.log("🚀 [2] 开始分发资金");
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   mUSDT 合约: ${deployData.biddingToken}`);

  const ERC20 = await ethers.getContractFactory("ERC20Mintable");
  const usdt = ERC20.attach(deployData.biddingToken);

  // --- A. 给真实用户发 mUSDT ---
  console.log(`\n📦 给 ${REAL_USERS.length} 个真实用户发 mUSDT...`);
  for (const user of REAL_USERS) {
      if(ethers.utils.isAddress(user)) {
          // 直接 Mint，省 Gas
          const tx = await usdt.mint(user, USDT_AMOUNT);
          await tx.wait();
          console.log(`   ✅ Sent 1000 U to ${user}`);
      }
  }

  // --- B. 生成并资助机器人 (Bots) ---
  console.log(`\n🤖 生成并资助 ${NUM_BOTS_TO_CREATE} 个机器人...`);
  let bots = [];
  
  // 如果之前已经生成过 bots，可以读取追加，这里为了演示每次覆盖
  for (let i = 0; i < NUM_BOTS_TO_CREATE; i++) {
      // 1. 创建随机钱包
      const wallet = ethers.Wallet.createRandom();
      const address = wallet.address;
      const privateKey = wallet.privateKey;
      
      console.log(`   [Bot ${i+1}] ${address}`);

      // 2. 发 mUSDT
      const txMint = await usdt.mint(address, USDT_AMOUNT);
      
      // 3. 发 ETH (Gas) - 必须要有 ETH 才能出价！
      const txEth = await deployer.sendTransaction({
          to: address,
          value: ETH_AMOUNT
      });

      // 等待交易确认 (为了防止 nonce 问题，最好由 Promise.all 并发处理，但循环更稳)
      await txMint.wait();
      await txEth.wait();

      bots.push({ address, privateKey });
  }

  // --- C. 保存机器人数据 ---
  // ⚠️ 包含私钥，千万不要上传到 GitHub
  fs.writeFileSync("bots.json", JSON.stringify(bots, null, 2));
  console.log(`\n💾 ${bots.length} 个机器人的私钥已保存至 bots.json (请勿分享!)`);
}

main().catch((error) => { console.error(error); process.exit(1); });