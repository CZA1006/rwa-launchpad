const hre = require("hardhat");
const { ethers } = hre;

// 🟢在此处填入你 12 小时前部署的 EasyAuction 地址
const EASY_AUCTION_ADDRESS = "0x1B01a9Bb95A52F269426b32a5B2a5473Df30D1Bd"; 
const AUCTION_ID = 1; 

// 🟢在此处填入你的 PROJ 代币地址 (如果找不到，去区块链浏览器查一下 EasyAuction 持有什么币)
const PROJ_TOKEN_ADDRESS = "0xYOUR_PROJ_TOKEN_ADDRESS"; 

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("🕵️‍♂️ 正在诊断拍卖状态...");
    console.log(`当前用户: ${deployer.address}`);
    console.log(`目标合约: ${EASY_AUCTION_ADDRESS}`);

    const EasyAuction = await ethers.getContractFactory("EasyAuction");
    const easyAuction = EasyAuction.attach(EASY_AUCTION_ADDRESS);

    // 1. 获取拍卖数据
    const auctionData = await easyAuction.auctionData(AUCTION_ID);
    
    // 2. 获取时间信息
    const currentTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
    const isEnded = currentTimestamp > auctionData.auctionEndDate;

    console.log("\n------------------------------------------------");
    console.log("📊 拍卖时间状态:");
    console.log(`   当前时间戳: ${currentTimestamp}`);
    console.log(`   拍卖结束时间: ${auctionData.auctionEndDate}`);
    console.log(`   是否已过期? ${isEnded ? "✅ 是 (可以结算)" : "❌ 否 (还在进行中)"}`);

    // 3. 获取结算状态
    // 如果 clearingPriceOrder 是 0，说明还没结算；如果不是 0，说明结算完了
    const isSettled = auctionData.clearingPriceOrder !== "0x0000000000000000000000000000000000000000000000000000000000000000";
    console.log("\n⚖️ 拍卖结算状态:");
    console.log(`   是否已结算? ${isSettled ? "✅ 已结算 (钱应该已经退了)" : "❌ 未结算 (资金还在合约里)"}`);

    // 4. 检查 PROJ 代币余额 (如果填了地址)
    if (PROJ_TOKEN_ADDRESS && PROJ_TOKEN_ADDRESS.startsWith("0x")) {
        const ERC20 = await ethers.getContractFactory("ERC20Mintable");
        const proj = ERC20.attach(PROJ_TOKEN_ADDRESS);
        
        const balanceContract = await proj.balanceOf(EASY_AUCTION_ADDRESS);
        const balanceUser = await proj.balanceOf(deployer.address);

        console.log("\n💰 资金去向 (PROJ 代币):");
        console.log(`   合约里还有: ${ethers.utils.formatEther(balanceContract)} PROJ`);
        console.log(`   你钱包里有: ${ethers.utils.formatEther(balanceUser)} PROJ`);
        
        if (balanceContract.gt(0)) {
            console.log("   👉 结论: 币还在合约里，你需要运行 settleAuction！");
        } else if (balanceUser.gt(0)) {
            console.log("   👉 结论: 币在你钱包里，说明已经退款成功了！");
        }
    }

    console.log("------------------------------------------------");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});