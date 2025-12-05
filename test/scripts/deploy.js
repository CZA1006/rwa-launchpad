const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs"); // 用于读写文件

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 [1] 开始部署，部署者:", deployer.address);

  // --- A. 部署合约 ---
  // 1. EasyAuction
  const EasyAuction = await ethers.getContractFactory("EasyAuction");
  const easyAuction = await EasyAuction.deploy();
  await easyAuction.deployed();
  console.log("✅ EasyAuction:", easyAuction.address);

  // 2. 项目代币 (PROJ)
  const ERC20Mintable = await ethers.getContractFactory("ERC20Mintable");
  const auctionToken = await ERC20Mintable.deploy("Project Token", "PROJ");
  await auctionToken.deployed();
  console.log("✅ PROJ:", auctionToken.address);

  // 3. 支付代币 (mUSDT)
  const biddingToken = await ERC20Mintable.deploy("Mock USDT", "mUSDT");
  await biddingToken.deployed();
  console.log("✅ mUSDT:", biddingToken.address);

  // --- B. 初始化拍卖 ---
  // 铸造 PROJ 给 deployer 并授权
  await auctionToken.mint(deployer.address, ethers.utils.parseEther("10000"));
  await auctionToken.approve(easyAuction.address, ethers.utils.parseEther("10000"));

  const currentTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const auctionEndDate = currentTimestamp + 3600; // 1小时后结束

  console.log("⏳ 发起拍卖...");
  const tx = await easyAuction.initiateAuction(
    auctionToken.address,
    biddingToken.address,
    auctionEndDate - 600,
    auctionEndDate,
    ethers.utils.parseEther("1000"), // 卖 1000 个
    ethers.utils.parseEther("500"),  // 最小募资 500 U
    ethers.utils.parseEther("0.01"), // 最小出价 0.01 U
    0, false, "0x0000000000000000000000000000000000000000", "0x"
  );
  
  const receipt = await tx.wait();
  const event = receipt.events.find(e => e.event === 'NewAuction');
  const auctionId = event.args.auctionId.toString();
  console.log(`🎉 拍卖已创建! ID: ${auctionId}`);

  // --- C. 保存地址到文件 (关键步骤) ---
  const deploymentInfo = {
    network: hre.network.name,
    easyAuction: easyAuction.address,
    auctionToken: auctionToken.address,
    biddingToken: biddingToken.address,
    auctionId: auctionId
  };

  fs.writeFileSync("deployments.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 部署信息已保存至 deployments.json");
}

main().catch((error) => { console.error(error); process.exit(1); });