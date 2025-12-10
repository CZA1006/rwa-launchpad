// 配置文件示例
// 复制此文件为 config.js 并填写实际值

module.exports = {
    // 服务器配置
    PORT: 3002,
    FRONTEND_URL: 'http://localhost:3000',
    
    // Anvil 本地链配置
    RPC_URL: 'http://127.0.0.1:8545',
    CHAIN_ID: 31337,
    
    // Relayer 私钥 (Anvil Account 0)
    RELAYER_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    
    // 合约地址 (部署后填写)
    SETTLEMENT_CONTRACT: '0x0000000000000000000000000000000000000000',
    GO_TOKEN: '0x0000000000000000000000000000000000000000',
    RWA_TOKEN: '0x0000000000000000000000000000000000000000',
    
    // 市场 ID (部署后填写)
    MARKET_ID: '0x0000000000000000000000000000000000000000000000000000000000000000'
};

